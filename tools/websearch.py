from tools.definitions import tool
from playwright.sync_api import sync_playwright

@tool(
    name="search_web",
    description="Search the web for information. Returns title, URL, and snippet for each result.",
    parameters={
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "The search query"
            },
            "max_results": {
                "type": "integer",
                "description": "Number of results to return (max 10)",
                "default": 5
            }
        },
        "required": ["query"]
    }
)
def search_web(query: str, max_results: int = 5):
    try:
        url = f"https://html.duckduckgo.com/html/?q={query}"
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
            page = context.new_page()
            page.goto(url, wait_until="domcontentloaded", timeout=20000)
            page.wait_for_timeout(3000)
            results = []
            items = page.query_selector_all(".result")
            for item in items[:max_results]:
                title_el = item.query_selector(".result__title a")
                snippet_el = item.query_selector(".result__snippet")
                if title_el:
                    results.append({
                        "title": title_el.inner_text().strip(),
                        "url": title_el.get_attribute("href", ""),
                        "snippet": snippet_el.inner_text().strip() if snippet_el else ""
                    })
            browser.close()
        if results:
            return {"results": results}
        return {"results": [], "note": "No results found via web search. Try using browse_page to visit specific URLs instead."}
    except Exception as e:
        return {"results": [], "error": str(e)}
