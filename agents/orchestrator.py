from agents.base import BaseAgent
from memory import store
from memory.recall import build_memory_context, summarize_and_extract
from tools.memory_tool import recall_memories
from workflow.engine import workflow_engine
import json
import tracker

ORCHESTRATOR_PROMPT = """You are an agent with the following tools at your disposal. You MUST use them when appropriate.

TOOLS:
- search_web(query) — Search the web for current information
- browse_page(url) — Visit any URL and read its content
- store_memory(key, content) — Save important facts about the user across sessions
- recall_memories(query) — Retrieve past memories about the user
- extract_pdf_text(file_path) — Read text from PDF files
- create_pdf(text, output_path) — Generate PDF documents
- create_file(content, filename) — Write code or documents to disk
- read_file(path) — Read any file from disk
- generate_image(prompt) — Generate an image from a text description using Qwen-Image. Use for ANY request to create/generate/make/draw an image.
- generate_video(prompt) — Generate a video from a text description using Wan 2.7. Use for ANY request to create/generate/make a video.

RULES:
- User wants an image? Call generate_image().
- User wants a video? Call generate_video().
- User wants info? Use search_web or browse_page.
- User shares personal info? Use store_memory to save it.
- NEVER tell the user you can't generate images or videos. You have dedicated tools for both.
- For comparisons: use markdown tables with emoji (🏆), bold headers, and clear sections (Playing Style, Stats, Verdict).
- For summaries: use ### headers, **bold** key points, bullet lists, and a concise verdict.
- Always format responses beautifully — tables, emojis, bold text, clear visual hierarchy."""

class OrchestratorAgent(BaseAgent):
    def __init__(self):
        super().__init__("orchestrator", ORCHESTRATOR_PROMPT)

    def process(self, session_id: str, user_message: str) -> dict:
        store.save_message(session_id, "user", user_message)

        memory_context = build_memory_context(session_id)
        recalled = recall_memories(user_message, n=3)
        memory_lines = []
        for r in recalled.get("results", []):
            memory_lines.append(f"- {r['content']} (key: {r['key']})")
        memories_str = "\n".join(memory_lines) if memory_lines else ""
        full_context = f"Past Memories:\n{memories_str}\n\nProfile:\n{memory_context}" if memories_str else memory_context

        history = store.get_history(session_id)
        recent = [{"role": m["role"], "content": m["content"]} for m in history[-8:] if m.get("content")]
        conversation = recent + [{"role": "user", "content": user_message}]

        reply, calls = self.run_with_tools(conversation, full_context)

        store.save_message(session_id, "assistant", reply)
        summarize_and_extract(session_id, history)

        agent_used = "orchestrator"
        if calls:
            agent_used = calls[0]["tool"] if len(calls) == 1 else "multi-tool"

        return {"reply": reply, "agent": agent_used, "tools_used": calls}

    def process_stream(self, session_id: str, user_message: str):
        store.save_message(session_id, "user", user_message)

        memory_context = build_memory_context(session_id)
        recalled = recall_memories(user_message, n=3)
        memory_lines = []
        for r in recalled.get("results", []):
            memory_lines.append(f"- {r['content']} (key: {r['key']})")
        memories_str = "\n".join(memory_lines) if memory_lines else ""
        full_context = f"Past Memories:\n{memories_str}\n\nProfile:\n{memory_context}" if memories_str else memory_context

        history = store.get_history(session_id)
        recent = [{"role": m["role"], "content": m["content"]} for m in history[-8:] if m.get("content")]
        conversation = recent + [{"role": "user", "content": user_message}]

        full_reply = ""
        for event in self.run_stream(conversation, full_context):
            yield event
            try:
                data_str = event.replace("data: ", "").strip()
                if data_str:
                    data = json.loads(data_str)
                    if data.get("type") == "token":
                        full_reply += data.get("content", "")
            except:
                pass

        store.save_message(session_id, "assistant", full_reply)
        summarize_and_extract(session_id, history)

        input_text = json.dumps([m.get("content","") for m in history[-10:]]) + full_context
        prompt_tokens = tracker.estimate_tokens(input_text)
        completion_tokens = tracker.estimate_tokens(full_reply) if full_reply else 0
        tracker.add(session_id, prompt_tokens, completion_tokens, self.model)
        yield f"data: {json.dumps({'type': 'usage', 'usage': tracker.get(session_id)})}\n\n"

        wf_type = self._detect_workflow(user_message, full_reply)
        if wf_type:
            workflow_engine.create_workflow(session_id, wf_type)
            yield f"data: {json.dumps({'type': 'workflow_start', 'workflow_id': session_id, 'workflow_type': wf_type})}\n\n"
            for wf_event in workflow_engine.execute_all_stream(session_id):
                yield f"data: {json.dumps(wf_event)}\n\n"

    def _detect_workflow(self, user_message: str, reply: str) -> str:
        msg_lower = user_message.lower()
        refund_keywords = ["refund", "return", "money back", "cancel order", "reimburse"]
        if any(word in msg_lower for word in refund_keywords):
            return "refund"
        support_keywords = ["support", "ticket", "bug", "issue", "problem", "help with",
                           "complaint", "not working", "error", "broken"]
        if any(word in msg_lower for word in support_keywords):
            return "support"
        return None
