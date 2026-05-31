# Agent Tools

| # | Tool | Purpose | Needs Setup |
|---|------|---------|-------------|
| 1 | **gmail** | Read/send emails | Gmail OAuth credentials |
| 2 | **playwright** | Browse web, fill forms, scrape | `playwright install` |
| 3 | **chromadb** | Vector memory (facts, summaries) | `pip install chromadb` |
| 4 | **pdf_extract** | Extract text from PDFs | None |
| 5 | **pdf_create** | Generate PDFs from text | None |
| 6 | **web_search** | Search web, return results | Free API (no key needed) |
| 7 | **file_create** | Write code files (py, sql, etc.) | None |
| 8 | **github** | Read repos, create issues, PRs | GitHub token |
| 9 | **file_viewer** | Browse/open files via web | None |

---

## 1. Gmail
- **read_emails**(query: str, max_results: int) → list of emails
- **send_email**(to: str, subject: str, body: str) → status

## 2. Playwright Browser
- **browse_page**(url: str, action: str) → screenshot + content
- **fill_and_submit**(url: str, fields: dict, button: str) → result

## 3. ChromaDB Memory
- **store_memory**(key: str, content: str, metadata: dict) → stored
- **recall_memories**(query: str, n: int) → relevant memories
- **summarize_and_compress**(session_id: str) → summary for next session
- Context limit detection → auto-trigger summarization

## 4. PDF Extract
- **extract_pdf_text**(file_path: str) → extracted text

## 5. PDF Create
- **create_pdf**(text: str, output_path: str) → creates PDF file

## 6. Web Search
- **search_web**(query: str) → search results with snippets

## 7. File Creator
- **create_file**(path: str, content: str) → writes file to disk

## 8. GitHub
- **create_issue**(repo: str, title: str, body: str) → issue URL
- **read_file**(repo: str, path: str) → file content
- **create_pr**(repo: str, title: str, body: str, head: str, base: str) → PR URL

## 9. File Viewer (Web)
- **list_files**(path: str) → directory listing
- **open_file**(path: str) → file content in browser
