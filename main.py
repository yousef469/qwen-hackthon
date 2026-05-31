from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File
from fastapi.responses import FileResponse, StreamingResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import uvicorn
import os
import json
import asyncio
import re
import websockets
import base64
import wave
import io
import struct
import tempfile

import tools
from memory.store import init as init_db, get_history, save_message
from agents.orchestrator import OrchestratorAgent
from agents.triage import TriageAgent
from agents.resolver import ResolverAgent
from agents.writer import WriterAgent
from agents.quality import QualityAgent
from workflow.engine import workflow_engine
from tools.definitions import TOOL_DEFINITIONS
from config import API_KEY, client

app = FastAPI()
orchestrator = OrchestratorAgent()

workflow_engine.register_agents({
    "triage": TriageAgent(),
    "resolve": ResolverAgent(),
    "draft_response": WriterAgent(),
    "quality_check": QualityAgent(),
})

init_db()

FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "frontend", "dist")

class ChatRequest(BaseModel):
    session_id: str
    message: str
    file_data: str | None = None
    file_mime: str | None = None
    file_filename: str | None = None

class TTSRequest(BaseModel):
    text: str
    voice: str = "Tina"

@app.post("/chat")
def chat(req: ChatRequest):
    return orchestrator.process(req.session_id, req.message)

@app.post("/chat/stream")
def chat_stream(req: ChatRequest):
    return StreamingResponse(
        orchestrator.process_stream(req.session_id, req.message, file_data=req.file_data, file_mime=req.file_mime, file_filename=req.file_filename),
        media_type="text/event-stream"
    )

@app.post("/extract-keypoints")
def extract_keypoints(req: ChatRequest):
    from config import client
    resp = client.chat.completions.create(
        model="qwen-plus",
        messages=[
            {"role": "system", "content": "Extract key points from the user's speech. Return a JSON array of strings, each string is one key point. Be concise."},
            {"role": "user", "content": req.message}
        ]
    )
    import json as j
    try:
        points = j.loads(resp.choices[0].message.content)
        return {"keypoints": points}
    except:
        return {"keypoints": [resp.choices[0].message.content]}

@app.post("/tts")
async def text_to_speech(req: TTSRequest):
    voice = req.voice
    omni_supported = {"Tina", "Mia", "Chloe", "Jennifer", "Cindy"}
    if voice not in omni_supported:
        voice = "Tina"

    URL = "wss://dashscope-intl.aliyuncs.com/api-ws/v1/realtime?model=qwen3.5-omni-plus-realtime"
    headers = {"Authorization": f"Bearer {API_KEY}"}
    audio_chunks = []

    try:
        async with websockets.connect(URL, extra_headers=headers, close_timeout=15) as ws:
            await ws.send(json.dumps({
                "type": "session.update",
                "session": {
                    "modalities": ["text", "audio"],
                    "voice": voice,
                    "output_audio_format": "pcm",
                    "instructions": "TTS MODE: The user sends text that must be spoken verbatim. Your ONLY output is that text spoken aloud. No additions, no responses, no extra words."
                }
            }))

            text = req.text[:600]
            await ws.send(json.dumps({
                "type": "conversation.item.create",
                "item": {
                    "type": "message",
                    "role": "user",
                    "content": [{"type": "input_text", "text": f"SPEAK THIS EXACT TEXT ALOUD: {text}"}]
                }
            }))

            await ws.send(json.dumps({"type": "response.create"}))

            async for message in ws:
                event = json.loads(message)
                etype = event.get("type", "")
                if etype == "response.audio.delta":
                    audio_chunks.append(base64.b64decode(event["delta"]))
                elif etype in ("response.done", "error"):
                    break
    except Exception as e:
        return {"error": f"Omni TTS failed: {e}"}, 500

    from fastapi.responses import Response
    wav_buf = io.BytesIO()
    with wave.open(wav_buf, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(24000)
        wf.writeframes(b"".join(audio_chunks))
    return Response(content=wav_buf.getvalue(), media_type="audio/wav")

OMNI_WS_URL = "wss://dashscope-intl.aliyuncs.com/api-ws/v1/realtime?model=qwen3.5-omni-plus-realtime"

OMNI_CONVERSATIONS: dict[str, dict] = {}

def resample_pcm(data: bytes, orig_rate: int, target_rate: int = 24000) -> bytes:
    if orig_rate == target_rate or len(data) < 4:
        return data
    samples = [struct.unpack("<h", data[i:i+2])[0] for i in range(0, len(data), 2)]
    ratio = orig_rate / target_rate
    new_len = int(len(samples) / ratio)
    resampled = []
    for i in range(new_len):
        src_idx = int(i * ratio)
        frac = (i * ratio) - src_idx
        if src_idx + 1 < len(samples):
            val = int(samples[src_idx] * (1 - frac) + samples[src_idx + 1] * frac)
        else:
            val = samples[src_idx]
        resampled.append(max(-32768, min(32767, val)))
    return struct.pack(f"<{len(resampled)}h", *resampled)

@app.websocket("/ws/omni")
async def omni_ws(ws: WebSocket):
    await ws.accept()
    conv_id = "omni_" + os.urandom(4).hex()
    OMNI_CONVERSATIONS[conv_id] = {"transcript_user": [], "transcript_assistant": [], "audio_buf": bytearray()}

    omni_headers = {"Authorization": f"Bearer {API_KEY}"}
    omni_outgoing = asyncio.Queue()
    omni_conn = None

    try:
        omni_conn = await websockets.connect(OMNI_WS_URL, extra_headers=omni_headers, close_timeout=30)
        await omni_conn.send(json.dumps({
            "type": "session.update",
            "session": {
                "modalities": ["text", "audio"],
                "voice": "Tina",
                "output_audio_format": "pcm",
                "input_audio_transcription": {"model": "whisper-1"},
                "turn_detection": {"type": "server_vad"},
                "instructions": (
                    "You are a friendly voice assistant powered by Qwen. "
                    "Have a natural voice conversation with the user. Answer questions, help with tasks, "
                    "and discuss any topic they bring up. Keep responses concise and conversational "
                    "since they're being read aloud. When the user is done, they will tap confirm."
                ),
            }
        }))

        async def omni_to_frontend():
            try:
                async for msg in omni_conn:
                    event = json.loads(msg)
                    etype = event.get("type", "")
                    if etype == "response.audio.delta":
                        await ws.send_json({"type": "audio", "data": event["delta"]})
                    elif etype == "response.audio_transcript.delta":
                        OMNI_CONVERSATIONS[conv_id]["transcript_assistant"].append(event["delta"])
                        await ws.send_json({"type": "transcript", "data": event["delta"]})
                    elif etype == "conversation.item.input_audio_transcription.completed":
                        t = event.get("transcript", "")
                        if t:
                            OMNI_CONVERSATIONS[conv_id]["transcript_user"].append(t)
                            await ws.send_json({"type": "user_transcript", "data": t})
                    elif etype == "response.done":
                        await ws.send_json({"type": "response_done"})
                    elif etype == "error":
                        await ws.send_json({"type": "error", "message": event.get("error", {}).get("message", str(event))})
            except Exception:
                pass

        async def frontend_to_omni():
            nonlocal omni_conn
            try:
                while True:
                    raw = await ws.receive_text()
                    data = json.loads(raw)
                    msg_type = data.get("type", "")

                    if msg_type == "audio":
                        sr = data.get("sample_rate", 24000)
                        pcm = base64.b64decode(data["data"])
                        if sr != 24000:
                            pcm = resample_pcm(pcm, sr)
                        await omni_conn.send(json.dumps({
                            "type": "input_audio_buffer.append",
                            "audio": base64.b64encode(pcm).decode()
                        }))

                    elif msg_type == "text":
                        await omni_conn.send(json.dumps({
                            "type": "conversation.item.create",
                            "item": {
                                "type": "message",
                                "role": "user",
                                "content": [{"type": "input_text", "text": data["text"]}]
                            }
                        }))
                        await omni_conn.send(json.dumps({"type": "response.create"}))

                    elif msg_type == "confirm":
                        break

            except Exception:
                pass
            finally:
                if omni_conn:
                    await omni_conn.close()
                    omni_conn = None

        await asyncio.gather(omni_to_frontend(), frontend_to_omni())

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await ws.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
    finally:
        if omni_conn:
            await omni_conn.close()

    conv = OMNI_CONVERSATIONS.get(conv_id, {})
    user_text = " ".join(conv.get("transcript_user", []))
    asst_text = " ".join(conv.get("transcript_assistant", []))
    full_dialogue = f"User: {user_text}\nAssistant: {asst_text}"

    try:
        from openai import OpenAI
        from config import client as api_client
        resp = api_client.chat.completions.create(
            model="qwen3.5-omni-plus",
            messages=[
                {"role": "system", "content": (
                    "Summarize the key discussion points from this voice conversation. "
                    "Return a JSON object with keys: "
                    "cards (array of {color, title, points}), "
                    "follow_up (a friendly question to continue the conversation). "
                    "Each card should have 2-4 bullet points. Use varied colors for cards."
                )},
                {"role": "user", "content": full_dialogue}
            ],
            response_format={"type": "json_object"}
        )
        result = json.loads(resp.choices[0].message.content)
        cards = result if isinstance(result, list) else result.get("cards", [])
        follow_up = result.get("follow_up") or result.get("followup", "")
    except Exception as e:
        cards = [{"color": "blue", "title": "Key Points", "points": ["Could not analyze conversation"]}]

    try:
        await ws.send_json({"type": "done", "keypoints": cards, "follow_up": follow_up or "Would you like to add anything or make changes?", "conversation": full_dialogue})
    except Exception:
        pass

    OMNI_CONVERSATIONS.pop(conv_id, None)

STR_INTERVIEWS: dict[str, dict] = {}

@app.post("/structured-interview")
def structured_interview(req: ChatRequest):
    sid = req.session_id
    now = STR_INTERVIEWS.get(sid, {"answers": [], "questions": [], "topic": ""})
    is_first = req.message is not None and not now.get("questions")

    def stream():
        nonlocal now
        try:
            if is_first:
                now["topic"] = req.message or ""

                # Stream model thinking + generate questions
                gen = client.chat.completions.create(
                    model="qwen3.5-omni-plus",
                    messages=[
                        {"role": "system", "content": (
                            "You are a design thinking facilitator. The user wants to start a project. "
                            "First, in a few sentences, analyze their project idea — consider who it's for, what it does, "
                            "what challenges exist, and how to measure success. "
                            "Then generate exactly 5 discovery questions, each with exactly 3 answer options. "
                            "Wrap the questions in a JSON code block at the end:\n"
                            '```json\n{"questions": [{"number": 1, "text": "...", "options": ["...","...","..."]}, ...]}\n```\n'
                            "Cover: 1) goals/vision, 2) target users, 3) core features, 4) constraints, 5) success metrics."
                        )},
                        {"role": "user", "content": f"Project topic: {req.message}"}
                    ],
                    stream=True
                )

                full = ""
                for chunk in gen:
                    c = chunk.choices[0].delta.content or ""
                    if c:
                        full += c
                        yield f"data: {json.dumps({'type': 'reasoning', 'content': c})}\n\n"

                # Parse JSON from the response
                m = re.search(r'```json\s*\n(.+?)\n```', full, re.DOTALL)
                if m:
                    try:
                        now["questions"] = json.loads(m.group(1)).get("questions", [])
                    except: pass
                if not now.get("questions"):
                    m = re.search(r'\{.*\}', full, re.DOTALL)
                    if m:
                        try:
                            now["questions"] = json.loads(m.group()).get("questions", [])
                        except: pass
                if not now.get("questions"):
                    now["questions"] = [
                        {"number": i, "text": f"Tell me about the {['goals','users','features','constraints','metrics'][i-1]} for your project?", "options": ["Option A", "Option B", "Option C"]}
                        for i in range(1, 6)
                    ]

                q = now["questions"][0]
                STR_INTERVIEWS[sid] = now
                yield f"data: {json.dumps({'type': 'question', 'number': 1, 'total': 5, 'text': q['text'], 'options': q.get('options', [])})}\n\n"

            else:
                answer_text = req.message or ""
                now["answers"].append(answer_text)
                q_idx = len(now["answers"])

                if q_idx < 5:
                    q = now["questions"][q_idx]
                    STR_INTERVIEWS[sid] = now
                    yield f"data: {json.dumps({'type': 'question', 'number': q_idx + 1, 'total': 5, 'text': q['text'], 'options': q.get('options', [])})}\n\n"
                else:
                    answers_text = "\n".join(
                        f"Q{i+1}: {now['questions'][i]['text'] if i < len(now['questions']) else '?'}\nA: {now['answers'][i] if i < len(now['answers']) else ''}"
                        for i in range(5)
                    )

                    # Generate keypoint cards + follow-up (streamed reasoning)
                    sum_resp = client.chat.completions.create(
                        model="qwen3.5-omni-plus",
                        messages=[
                            {"role": "system", "content": (
                                "Based on the Q&A transcript below, think through the key insights for each topic, "
                                "then extract exactly 5 key point cards. "
                                "Assign each card a color: blue (goals), red (users), green (features), "
                                "yellow (constraints), white (metrics). "
                                "After the cards, generate a follow-up question asking if they'd like to refine anything. "
                                "Wrap the result in a JSON code block:\n"
                                '```json\n{"cards": [{"color":"...","title":"...","points":["...","..."]}], "follow_up": "..."}\n```'
                            )},
                            {"role": "user", "content": answers_text}
                        ],
                        stream=True
                    )

                    full = ""
                    for chunk in sum_resp:
                        c = chunk.choices[0].delta.content or ""
                        if c:
                            full += c
                            yield f"data: {json.dumps({'type': 'reasoning', 'content': c})}\n\n"

                    m = re.search(r'```json\s*\n(.+?)\n```', full, re.DOTALL)
                    cards, follow_up = [], "Would you like to refine any of these points?"
                    if m:
                        try:
                            r2 = json.loads(m.group(1))
                            cards = r2.get("cards", [])
                            follow_up = r2.get("follow_up", follow_up)
                        except: pass
                    if not cards:
                        m = re.search(r'\{.*\}', full, re.DOTALL)
                        if m:
                            try:
                                r2 = json.loads(m.group())
                                cards = r2.get("cards", [])
                                follow_up = r2.get("follow_up", follow_up)
                            except: pass
                    if not cards:
                        try:
                            fb = client.chat.completions.create(
                                model="qwen3.5-omni-plus",
                                response_format={"type": "json_object"},
                                messages=[{"role": "user", "content": f"Create 5 keypoint cards from: {answers_text}"}]
                            )
                            fb_r = json.loads(fb.choices[0].message.content)
                            cards = fb_r.get("cards", [])
                            follow_up = fb_r.get("follow_up", follow_up)
                        except: pass

                    yield f"data: {json.dumps({'type': 'done', 'keypoints': cards, 'follow_up': follow_up})}\n\n"
                    STR_INTERVIEWS.pop(sid, None)
                    return

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")

@app.get("/api/video-status/{task_id}")
def video_status(task_id: str):
    import httpx
    url = f"https://dashscope-intl.aliyuncs.com/api/v1/tasks/{task_id}"
    headers = {"Authorization": f"Bearer {API_KEY}"}
    try:
        resp = httpx.get(url, headers=headers, timeout=10)
        data = resp.json()
        output = data.get("output", {})
        status = output.get("task_status", "UNKNOWN")
        result = {"task_id": task_id, "status": status}
        if status == "SUCCEEDED":
            result["video_url"] = output.get("video_url", "")
        return result
    except Exception as e:
        return {"task_id": task_id, "status": "ERROR", "error": str(e)}

@app.get("/api/token-usage/{session_id}")
def token_usage(session_id: str):
    import tracker
    return tracker.get(session_id)

@app.post("/api/reset-session/{session_id}")
def reset_session(session_id: str):
    import tracker
    tracker.reset(session_id)
    from memory.store import clear_all_memories
    clear_all_memories()
    return {"status": "reset", "cleared": True}

@app.post("/api/add-context/{session_id}")
def add_context(session_id: str, req: ChatRequest):
    save_message(session_id, "user", req.message)
    import tracker
    prompt = tracker.estimate_tokens(req.message)
    tracker.add(session_id, prompt, 0)
    return {"status": "ok"}

@app.get("/history/{session_id}")
def history(session_id: str):
    return {"messages": get_history(session_id)}

@app.get("/tools")
def list_tools():
    return {"tools": [t["function"]["name"] for t in TOOL_DEFINITIONS]}

class SummaryRequest(BaseModel):
    messages: list[dict]

class ApprovalRequest(BaseModel):
    session_id: str
    reason: str = ""

def sanitize_for_json(obj):
    if isinstance(obj, str):
        return obj.encode('utf-8', errors='replace').decode('utf-8').translate({i:None for i in range(32) if i not in (9,10,13)})
    if isinstance(obj, dict):
        return {k: sanitize_for_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [sanitize_for_json(v) for v in obj]
    return obj

@app.get("/workflow/{session_id}/status")
def workflow_status(session_id: str):
    status = workflow_engine.get_status(session_id)
    if not status:
        return {"error": "No active workflow"}, 404
    return sanitize_for_json(status)

@app.post("/workflow/{session_id}/approve")
def workflow_approve(session_id: str):
    ok = workflow_engine.approve(session_id)
    if not ok:
        return {"error": "No workflow awaiting approval"}, 400
    return {"status": "approved"}

@app.post("/workflow/{session_id}/reject")
def workflow_reject(session_id: str, req: ApprovalRequest):
    ok = workflow_engine.reject(session_id, req.reason)
    if not ok:
        return {"error": "No workflow awaiting approval"}, 400
    return {"status": "rejected"}

@app.get("/workflow/{session_id}/stream")
def workflow_stream(session_id: str):
    return StreamingResponse(
        workflow_engine.execute_all_stream(session_id),
        media_type="text/event-stream"
    )

# ── Design Interview ──────────────────────────────────────────
# Pure voice-to-voice design interview. AI thinks, asks 5 dynamic questions,
# user answers via voice, key points appear as pinned cards in chat.
DESIGN_INTERVIEWS = {}

Q_SYSTEM_PROMPT = """You are a design interview assistant. Your job is to ask ONE focused design question at a time.

Rules:
- Think carefully about what information is most important to know given the topic and previous answers.
- Ask ONE short, specific question — never multiple questions at once.
- Adapt each question based on what the user already told you.
- Don't repeat topics already covered.
- Keep questions conversational, like a real design partner.

Topic: {topic}
Conversation so far:
{history}

Think about what to ask next, then output ONLY your question, no preamble."""

KP_SYSTEM_PROMPT = "Extract 1-2 very concise key points from this design answer. Return ONLY a JSON array of strings, each max 10 words."

DOC_SYSTEM_PROMPT = """You are a design document generator. Based on the Q&A session below, produce a clean design document. Sections: Overview, Tech Stack, Core Features, UI/UX Approach, Data Model, Edge Cases & Error Handling. Keep it practical and concise.

Q&A:
{context}"""

@app.post("/design-interview")
def design_interview(req: ChatRequest):
    sid = req.session_id
    msg = req.message
    from config import client as llm

    if sid not in DESIGN_INTERVIEWS:
        DESIGN_INTERVIEWS[sid] = {
            "status": "active",
            "round": 0,
            "max_rounds": 5,
            "topic": "",
            "qa_history": []
        }

    state = DESIGN_INTERVIEWS[sid]

    def stream():
        # ── First call: topic provided → generate Q1 ──
        if state["round"] == 0:
            state["topic"] = msg
            try:
                resp = llm.chat.completions.create(
                    model="qwen-plus",
                    messages=[{"role": "user", "content": Q_SYSTEM_PROMPT.format(topic=msg, history="(none yet)")}],
                    extra_body={"enable_thinking": True, "thinking_config": {"max_tokens": 1024}}
                )
                q1 = resp.choices[0].message.content.strip()
            except:
                q1 = "Tell me more about what you want to build."
            state["qa_history"].append({"question": q1, "answer": "", "keypoints": []})
            state["round"] = 1
            yield f"data: {json.dumps({'type': 'question', 'text': q1, 'number': 1, 'total': 5, 'reasoning': getattr(resp.choices[0].message, 'reasoning_content', None) or ''})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
            return

        # ── Subsequent calls: answer → keypoints → next question or doc ──
        if state["status"] != "active":
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
            return

        r = state["round"]
        prev = state["qa_history"][-1]
        prev["answer"] = msg

        # Extract keypoints from this answer
        try:
            kp_resp = llm.chat.completions.create(
                model="qwen-plus",
                messages=[
                    {"role": "system", "content": KP_SYSTEM_PROMPT},
                    {"role": "user", "content": msg}
                ]
            )
            kps = json.loads(kp_resp.choices[0].message.content)
            if not isinstance(kps, list):
                kps = [msg[:80]]
        except:
            kps = [msg[:80]]
        prev["keypoints"] = kps

        yield f"data: {json.dumps({'type': 'keypoint', 'keypoints': kps, 'number': r})}\n\n"

        # If we've done 5 rounds → generate design doc, switch to text mode
        if r >= state["max_rounds"]:
            context = "\n".join([
                f"Q{h['question']}\nA: {h['answer']}"
                for h in state["qa_history"]
            ])
            try:
                doc_resp = llm.chat.completions.create(
                    model="qwen-plus",
                    messages=[{"role": "user", "content": DOC_SYSTEM_PROMPT.format(context=context)}]
                )
                doc = doc_resp.choices[0].message.content
            except:
                doc = "Design document generation failed."
            state["status"] = "complete"
            yield f"data: {json.dumps({'type': 'mode_switch', 'mode': 'text'})}\n\n"
            yield f"data: {json.dumps({'type': 'design_doc', 'text': doc, 'topic': state['topic']})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
            return

        # Generate next question based on full conversation
        history_lines = [f"Q{h['question']}\nA: {h['answer']}" for h in state["qa_history"]]
        try:
            next_resp = llm.chat.completions.create(
                model="qwen-plus",
                messages=[{"role": "user", "content": Q_SYSTEM_PROMPT.format(
                    topic=state["topic"],
                    history="\n\n".join(history_lines)
                )}],
                extra_body={"enable_thinking": True, "thinking_config": {"max_tokens": 1024}}
            )
            next_q = next_resp.choices[0].message.content.strip()
            reasoning = getattr(next_resp.choices[0].message, 'reasoning_content', None) or ''
        except:
            next_q = "Anything else you'd like to add?"
            reasoning = ''

        state["qa_history"].append({"question": next_q, "answer": "", "keypoints": []})
        state["round"] = r + 1

        yield f"data: {json.dumps({'type': 'question', 'text': next_q, 'number': r + 1, 'total': 5, 'reasoning': reasoning})}\n\n"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")

@app.post("/api/export-pdf")
def export_pdf(req: SummaryRequest):
    from fpdf import FPDF
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", size=16)
    pdf.cell(200, 10, text="Chat Export", new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.ln(5)
    pdf.set_font("Helvetica", size=10)
    for m in req.messages:
        role = m.get("role", "user").upper()
        content = m.get("content", "")
        if not content:
            continue
        pdf.set_font("Helvetica", size=10, style="B")
        pdf.cell(200, 8, text=f"[{role}]", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", size=10)
        for line in content.split("\n"):
            pdf.multi_cell(200, 6, text=line[:200])
        pdf.ln(3)
    buf = io.BytesIO()
    pdf.output(buf)
    buf.seek(0)
    return Response(
        content=buf.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=chat-export.pdf"}
    )


ALLOWED_EXTENSIONS = {"pdf", "png", "jpg", "jpeg", "gif", "webp", "txt", "md", "py", "js", "ts", "html", "css", "json", "csv", "xml", "yaml", "toml", "ini", "cfg", "log", "sql"}

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    content = await file.read()
    filename = file.filename or "unknown"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        return JSONResponse({"error": f"Unsupported file type: .{ext}"}, status_code=400)

    result = {"filename": filename, "type": ext}

    if ext == "pdf":
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
        try:
            tmp.write(content)
            tmp.close()
            from tools.pdf_tools import extract_pdf_text as extract_pdf
            r = extract_pdf(tmp.name)
            result["text"] = r["text"]
        finally:
            os.unlink(tmp.name)

    elif ext in ("png", "jpg", "jpeg", "gif", "webp"):
        import base64 as b64mod
        b64 = b64mod.b64encode(content).decode()
        mime = f"image/{'jpeg' if ext == 'jpg' else ext}"
        result["b64"] = b64
        result["mime"] = mime
        try:
            resp = client.chat.completions.create(
                model="qwen3.5-omni-plus",
                messages=[{"role": "user", "content": [
                    {"type": "text", "text": "Describe this image in detail. What do you see? Be specific."},
                    {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}}
                ]}]
            )
            result["description"] = resp.choices[0].message.content or ""
        except Exception as e:
            result["description"] = f"(Could not analyze image: {e})"

    else:
        result["text"] = content.decode("utf-8", errors="replace")

    return result


IMAGE_GEN_URL = "https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation"

@app.post("/api/generate-image")
def generate_image(req: ChatRequest):
    import httpx
    try:
        payload = {
            "model": "qwen-image-2.0-pro",
            "input": {
                "messages": [
                    {"role": "user", "content": [{"text": req.message}]}
                ]
            },
            "parameters": {
                "negative_prompt": "Low quality, blurry, distorted, ugly, deformed",
                "prompt_extend": True,
                "watermark": False,
                "size": "1024*1024",
                "n": 1,
            }
        }
        headers = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}
        resp = httpx.post(IMAGE_GEN_URL, json=payload, headers=headers, timeout=120)
        resp.raise_for_status()
        data = resp.json()
        content_list = data.get("output", {}).get("choices", [{}])[0].get("message", {}).get("content", [])
        image_url = None
        for item in content_list:
            if "image" in item:
                image_url = item["image"]
                break
        if not image_url:
            return JSONResponse({"error": "No image returned from API"}, status_code=500)
        img_resp = httpx.get(image_url, timeout=30)
        img_b64 = base64.b64encode(img_resp.content).decode()
        mime = img_resp.headers.get("content-type", "image/png")
        return {"image_b64": img_b64, "mime": mime, "prompt": req.message}
    except Exception as e:
        return JSONResponse({"error": f"Image generation failed: {e}"}, status_code=500)


app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")), name="assets")

@app.get("/")
def index():
    return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))

@app.get("/{full_path:path}")
def spa_fallback(full_path: str):
    api_routes = ["chat", "history", "extract-keypoints", "tools", "workflow", "tts", "design-interview", "structured-interview", "api"]
    if full_path in api_routes or full_path.startswith(tuple(r + "/" for r in api_routes)):
        return JSONResponse({"error": "Not found"}, status_code=404)
    return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
