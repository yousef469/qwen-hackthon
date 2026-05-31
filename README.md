---
title: Qwen Agent Platform
emoji: 🤖
colorFrom: pink
colorTo: purple
sdk: docker
pinned: false
---

# Qwen Agent Platform

**MemoryAgent · Voice · Vision · Image Gen · Workflows**

A production-grade multi-agent platform built on **Qwen Cloud API** (Alibaba Cloud Model Studio) for the **2026 Qwen Cloud Hackathon**. Combines persistent memory, specialized agent routing, structured workflow automation, Omni realtime voice, structured interviews, file analysis, and image generation — all in a single chat interface.

**Covers 3 tracks:** MemoryAgent, Agent Society, Autopilot Agent

---

## Features

### Chat + Intent Detection
- **Normal chat** — General Q&A via `/chat/stream` with orchestrator + 8 function tools
- **Structured interview** — Type a project idea → AI generates 5 discovery questions with 3 options each → colored keypoint cards appear after Q5
- **Compare** — Type "compare X vs Y" → web search + LLM → notebook-paper left/right notes with overall verdict
- **Summary** — Type "summarize this" → structured summary card of the conversation
- **Image generation** — Click 🎨 or type "generate an image of..." → `qwen-image-2.0-pro` generates PNG → pink/white animation → download button

### Multi-Agent System
- **Orchestrator** — Entry point, intent detection, workflow routing, 8 function tools
- **Agent Society** — Triage, Resolver, Writer, Quality agents with specialized prompts
- **Tool ecosystem** — `search_web`, `browse_page`, `extract_pdf_text`, `create_pdf`, `create_file`, `read_file`, `list_files`, `store_memory`, `recall_memories`

### MemoryAgent
- Qwen `text-embedding-v4` + SQLite + cosine similarity
- Auto-extracts personal facts (name, age, preferences) — skips conversational filler
- Cross-session recall via `recall_memories` tool and `build_memory_context` injection

### Autopilot Workflows
- **Support ticket** — Triage → Resolve → Draft → Quality → Approve → Send
- **Refund** — Verify → Policy → Calculate → Approve → Process → Notify
- Human-in-the-loop approval with inline Approve/Reject buttons

### Voice (Omni Realtime)
- WebSocket proxy to `qwen3.5-omni-plus-realtime`
- Server-side VAD, whisper-1 transcription, PCM audio streaming
- 5-question design interview → confirmed → colored keypoint cards
- Voices: Tina, Mia, Chloe, Jennifer, Cindy

### File Upload & Analysis
- Upload PDF, images, text files via 📎 button or **drag-and-drop**
- PDF: text extraction via pypdf
- Images: vision analysis via `qwen3.5-omni-plus`
- File content automatically saved to conversation history so the AI can reference it

### UI
- Streaming tokens with blink cursor
- Collapsible reasoning panel (full text, no scroll limit)
- Collapsible tool call display
- Colored notebook-paper pinned note cards (blue/red/green/yellow/white, 3+2 grid)
- Token counter in header (Xk / 128k) with new session button
- Speaking indicator, uploading indicator, image mode badge

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
| **Normal chat** | Type any message | Orchestrator routes through agents, calls tools, streams response |
| **Structured interview** | Type "I want to build a..." or "plan/create/design a project" | AI generates 5 questions with options → answer → colored cards |
| **Compare** | Type "compare X vs Y" | Web search + LLM → notebook-paper pros/cons + overall verdict |
| **Summary** | Type "summarize this" | LLM → structured summary card |
| **Image gen** | Click 🎨 then type prompt, or type "generate an image of..." | Qwen-Image → PNG with pink/white animation → download |
| **Voice** | Click 🎤 mic button | Omni realtime conversation → 5 questions → colored cards |
| **File upload** | Click 📎 or drag-and-drop onto chat | PDF/image/text analyzed, content added to conversation |
| **Workflow** | "I need a refund" or "I have a support ticket" | Multi-step workflow with Approve/Reject gates |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/chat/stream` | Streaming chat (SSE) — main entry point |
| GET | `/history/{session_id}` | Chat history |
| POST | `/structured-interview` | 5-question project interview (SSE) |
| POST | `/api/compare` | Compare two items (web search + LLM) |
| POST | `/api/summary` | Summarize conversation |
| POST | `/api/generate-image` | Generate image via `qwen-image-2.0-pro` |
| POST | `/api/upload` | Upload file (PDF/image/text) |
| GET | `/api/token-usage/{session_id}` | Current token count |
| POST | `/api/add-context/{session_id}` | Save context message to history |
| POST | `/api/reset-session/{session_id}` | Reset token counter |
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
│   ├── orchestrator.py         Entry point, workflow detection, token tracking
│   ├── triage.py               Issue classification
│   ├── resolver.py             Solution finding
│   ├── writer.py               Response drafting
│   └── quality.py              Quality review
├── workflow/
│   └── engine.py               WorkflowEngine state machine
├── tools/
│   ├── definitions.py          @tool decorator
│   ├── registry.py             Tool execution
│   ├── memory_tool.py          Vector memory (Qwen embeddings + SQLite)
│   ├── websearch.py            DuckDuckGo search via Playwright
│   ├── browser.py              Page reader via Playwright
│   ├── pdf_tools.py            PDF extract/create (pypdf, fpdf2)
│   └── file_ops.py             File read/write/list
├── memory/
│   ├── store.py                SQLite schema + CRUD
│   └── recall.py               Fact extraction, memory context building
├── frontend/
│   ├── src/
│   │   ├── App.tsx             Layout, intent routing, all handlers
│   │   ├── types.ts            All TypeScript types
│   │   ├── hooks/
│   │   │   ├── useChat.ts      SSE streaming, tokens, workflows, session
│   │   │   ├── useOmniVoice.ts Omni WebSocket + AudioContext
│   │   │   └── useStructuredInterview.ts  SSE for 5-question interview
│   │   └── components/
│   │       ├── ChatArea.tsx    Messages, cards, drag-drop, workflow UI
│   │       ├── InputBar.tsx    Text, mic, upload, image, confirm/end
│   │       ├── CompareView.tsx Notebook-paper left/right comparison
│   │       ├── SummaryView.tsx Structured summary card
│   │       ├── ImageDisplay.tsx Qwen-Image display + download
│   │       ├── PinnedNoteCard.tsx Colored grid cards with shape icons
│   │       ├── QuestionPanel.tsx 3-option + custom answer panel
│   │       ├── VoiceOverlay.tsx Omni voice overlay
│   │       └── Sidebar.tsx     Agent status
│   └── dist/                   Built frontend (served by FastAPI)
└── assets/
    └── architecture.svg
```

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Vite 8
- **Backend**: FastAPI, Uvicorn, OpenAI SDK, httpx, websockets
- **LLM**: Qwen3.5-omni-plus, Qwen-plus, Qwen-image-2.0-pro via Alibaba Cloud Model Studio
- **Voice**: Omni Realtime WebSocket (`wss://dashscope-intl.aliyuncs.com/api-ws/v1/realtime`)
- **Memory**: Qwen text-embedding-v4 + SQLite + cosine similarity
- **Tools**: Playwright, pypdf, fpdf2

---

## Submission

**Qwen Cloud Hackathon 2026** — Built with Qwen Cloud API (Alibaba Cloud Model Studio).

- [Qwen Cloud Console](https://www.aliyun.com/product/bailian)
- [Model Studio API](https://help.aliyun.com/zh/model-studio/)
- [Hackathon on Devpost](https://qwen-hackathon.devpost.com)
