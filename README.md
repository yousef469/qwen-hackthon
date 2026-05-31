---
title: QwenMind
emoji: 🧠
colorFrom: pink
colorTo: purple
sdk: docker
pinned: false
---

# QwenMind

**MemoryAgent · Omni Voice · Vision · Image/Video Gen · Workflows**

A multimodal AI agent platform built on **Qwen Cloud API** (Alibaba Cloud Model Studio) for the **2026 Qwen Cloud Hackathon**. One orchestrator agent with persistent vector memory, real-time voice, file analysis, image/video generation, and automated workflows — all in a single chat interface.

**Track:** MemoryAgent

---

## Features

### Orchestrator + Tool Ecosystem
Single `qwen3.5-omni-plus` agent with 11 function tools:
- `search_web` — DuckDuckGo search via Playwright
- `browse_page` — Read any URL
- `store_memory` / `recall_memories` — Cross-session vector memory
- `extract_pdf_text` / `create_pdf` — PDF read/write
- `create_file` / `read_file` — File system operations
- `generate_image` — Qwen-Image 2.0 Pro (base64 PNG)
- `generate_video` — Wan 2.7 T2V (async, polling)
- All routing done by the LLM — no frontend pattern matching

### MemoryAgent
- Qwen `text-embedding-v4` → 1536-dim vectors → SQLite + cosine similarity
- Auto-extracts personal facts from every conversation
- Cross-session recall via `recall_memories` tool + `build_memory_context` injection

### Omni Realtime Voice
- WebSocket proxy to `qwen3.5-omni-plus-realtime`
- Server-side VAD, whisper-1 transcription, PCM audio streaming
- General assistant (not interview-bound) — open conversation
- After ending: AI summarizes key points as colored notebook-paper cards
- Voices: Tina, Mia, Chloe, Jennifer, Cindy

### Image & Video Generation
- **Image:** Qwen-Image 2.0 Pro via tool calling — pink shimmer skeleton during generation, transitions to final PNG with download button
- **Video:** Wan 2.7 T2V via async API — frontend polls every 10s, auto-displays `<video>` when ready
- Both triggered naturally by the LLM — no frontend special-casing

### Structured Interview
- Type "I want to build a..." or "plan/create/design a project"
- AI generates 5 discovery questions with 3 options each
- Colored keypoint cards + follow-up question after Q5

### File Upload
- Drag-and-drop or 📎 button for PDF, images, text files
- Shows as an attachment preview **above the input bar** (not auto-sent)
- Images: analyzed by multimodal model (actual pixels, not text description)
- PDFs: text extracted via pypdf
- User types their question and sends — file data goes with the message

### Autopilot Workflows
- **Support ticket** — Triage → Resolve → Draft → Quality → Approve → Send
- **Refund** — Verify → Policy → Calculate → Approve → Process → Notify
- Human-in-the-loop approval with inline Approve/Reject buttons
- WorkflowEngine state machine with SSE streaming

### Compare & Summary
- Handled by the orchestrator with markdown formatting rules
- Compare: tables with emoji (🏆), bold headers, clear sections
- Summary: ### headers, bullet lists, concise verdict

### UI
- Streaming tokens with blink cursor
- Collapsible reasoning panel
- Collapsible tool call display
- Colored notebook-paper pinned note cards (3+2 grid)
- Token counter (Xk / 32k) with red warning >80%
- Image shimmer loading animation, video auto-play
- Interruption: typing while streaming cancels via AbortController
- Reset session clears all data (conversations, profiles, vector memory)
- PDF export (📥) of entire conversation
- Animations: slide-up, scale-in, float-up, pulse-glow

---

## Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- Qwen Cloud API key — [Sign up](https://www.aliyun.com/product/bailian)

### 1. Backend

```bash
pip install -r requirements.txt
python3 -m playwright install chromium
export QWEN_API_KEY="sk-..."
python3 main.py
```

Server runs on `http://localhost:8000`.

### 2. Frontend (dev mode)

```bash
cd frontend
npm install
npm run dev
```

Dev server on `http://localhost:5173` (proxied to `:8000`).

### 3. Production build

```bash
cd frontend && npm run build
# FastAPI serves frontend/dist/ automatically
```

---

## Usage

| Mode | How to trigger | What happens |
|------|---------------|--------------|
| **Normal chat** | Type any message | Orchestrator calls tools, streams response with markdown |
| **Structured interview** | Type "I want to build a..." or "plan/create/design a project" | AI generates 5 questions with options → answer → colored cards |
| **Compare** | Type "compare X vs Y" | Orchestrator uses search_web + markdown table |
| **Summary** | Type "summarize this" | Orchestrator responds with structured markdown |
| **Image gen** | "generate an image of..." | Qwen-Image via tool call → pink shimmer → download |
| **Video gen** | "create a video of..." | Wan 2.7 via tool call → async polling → auto-play |
| **Voice** | Click 🎤 mic button | Omni realtime conversation → keypoints on end |
| **File upload** | Click 📎 or drag-and-drop | Attachment preview above input → type question → send with file data |
| **Workflow** | "I need a refund" or "I have a support ticket" | Multi-step workflow with Approve/Reject gates |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/chat/stream` | Streaming chat (SSE) — main entry point |
| GET | `/history/{session_id}` | Chat history |
| POST | `/structured-interview` | 5-question project interview (SSE) |
| POST | `/api/generate-image` | Generate image via `qwen-image-2.0-pro` |
| POST | `/api/upload` | Upload file (PDF/image/text) |
| GET | `/api/video-status/{task_id}` | Poll Wan 2.7 task status |
| GET | `/api/token-usage/{session_id}` | Current token count |
| POST | `/api/add-context/{session_id}` | Save context message to history |
| POST | `/api/reset-session/{session_id}` | Reset token counter + clear memories |
| POST | `/api/export-pdf` | Export conversation as PDF |
| POST | `/tts` | Omni text-to-speech (PCM → WAV) |
| WS | `/ws/omni` | Omni realtime voice conversation |
| GET | `/workflow/{session_id}/status` | Workflow state |
| POST | `/workflow/{session_id}/approve` | Approve workflow step |
| POST | `/workflow/{session_id}/reject` | Reject workflow step |
| GET | `/workflow/{session_id}/stream` | Resume workflow stream |
| GET | `/tools` | List available tools |
| POST | `/extract-keypoints` | Extract key points from text |

---

## SSE Event Types (chat/stream)

| Event | When |
|-------|------|
| `token` | Streamed text token |
| `reasoning` | Thinking/reasoning trace |
| `tool_call` | Tool invocation started |
| `tool_result` | Tool result received |
| `usage` | Token count for this exchange |
| `workflow_start` | Workflow detected |
| `workflow_step` | Step completed |
| `approval_request` | Human approval needed |
| `workflow_complete` | All steps done |
| `done` | Response complete |

---

## Project Structure

```
├── main.py                     FastAPI server + all routes
├── config.py                   Qwen OpenAI-compatible client
├── tracker.py                  Per-session token usage tracker
├── agents/
│   ├── base.py                 BaseAgent (LLM calls, streaming, tools)
│   ├── orchestrator.py         Entry point, memory injection, workflow detection
│   ├── triage.py               Issue classification (workflow use)
│   ├── resolver.py             Solution finding (workflow use)
│   ├── writer.py               Response drafting (workflow use)
│   └── quality.py              Quality review (workflow use)
├── workflow/
│   └── engine.py               WorkflowEngine state machine
├── tools/
│   ├── definitions.py          @tool decorator
│   ├── registry.py             Tool execution
│   ├── memory_tool.py          Vector memory (Qwen embeddings + SQLite)
│   ├── websearch.py            DuckDuckGo search via Playwright
│   ├── browser.py              Page reader via Playwright
│   ├── media_tools.py          Image gen (Qwen-Image) + video gen (Wan 2.7)
│   ├── pdf_tools.py            PDF extract/create (pypdf, fpdf2)
│   └── file_ops.py             File read/write
├── memory/
│   ├── store.py                SQLite schema + CRUD
│   └── recall.py               Fact extraction, memory context building
├── frontend/
│   ├── src/
│   │   ├── App.tsx             Layout, handlers, pending file state
│   │   ├── types.ts            All TypeScript types
│   │   ├── hooks/
│   │   │   ├── useChat.ts      SSE streaming, tokens, workflows, file data
│   │   │   ├── useOmniVoice.ts Omni WebSocket + AudioContext
│   │   │   └── useStructuredInterview.ts  SSE for 5-question interview
│   │   └── components/
│   │       ├── ChatArea.tsx    Messages, cards, drag-drop, workflow UI
│   │       ├── InputBar.tsx    Text, mic, upload, attachment preview
│   │       ├── ImageDisplay.tsx Shimmer loading + image display + download
│   │       ├── PinnedNoteCard.tsx Colored grid cards
│   │       ├── QuestionPanel.tsx 3-option + custom answer panel
│   │       ├── VoiceOverlay.tsx Omni voice overlay
│   │       └── Sidebar.tsx     Session info
│   └── dist/                   Built frontend (served by FastAPI)
├── assets/
│   └── architecture.svg
├── Dockerfile                  HF Spaces / Render deployment
└── render.yaml                 Render blueprint config
```

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Vite 8
- **Backend**: FastAPI, Uvicorn, OpenAI SDK, httpx, websockets
- **LLM**: Qwen3.5-omni-plus, Qwen-Image 2.0 Pro, Wan 2.7 T2V via Alibaba Cloud Model Studio
- **Voice**: Omni Realtime WebSocket (`wss://dashscope-intl.aliyuncs.com/api-ws/v1/realtime`)
- **Memory**: Qwen text-embedding-v4 + SQLite + cosine similarity
- **Tools**: Playwright (web search + browser), pypdf, fpdf2, DuckDuckGo Search
- **Deployment**: Docker, Hugging Face Spaces

---

## Architecture

![Architecture Diagram](assets/architecture.svg)

The system uses a single orchestrator agent that:
1. Receives the user's message + file data
2. Injects recalled memories + extracted facts from SQLite
3. Passes the last 8 history messages (or multimodal content for images)
4. Streams the LLM response with token-by-token SSE
5. Handles tool calls (search, memory, image, video, PDF, file ops) as the LLM requests them
6. Detects workflow intents and runs the WorkflowEngine state machine

---

## Submission

**Qwen Cloud Hackathon 2026** — Built with Qwen Cloud API (Alibaba Cloud Model Studio).

- [Live Demo](https://huggingface.co/spaces/simplyyousef/qwen-hackthon)
- [GitHub Repo](https://github.com/yousef469/qwen-hackthon)
- [Qwen Cloud Console](https://www.aliyun.com/product/bailian)
- [Model Studio API](https://help.aliyun.com/zh/model-studio/)
- [Hackathon on Devpost](https://qwen-hackathon.devpost.com)
