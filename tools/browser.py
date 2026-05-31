from tools.definitions import tool
from playwright.sync_api import sync_playwright

@tool(
    name="browse_page",
    description="Open a URL and get its text content and title. Useful for reading web pages.",
    parameters={
        "type": "object",
        "properties": {
            "url": {
                "type": "string",
                "description": "The URL to visit"
            },
            "extract_text": {
                "type": "boolean",
                "description": "Extract visible text from the page",
                "default": True
            }
        },
        "required": ["url"]
    }
)
def browse_page(url: str, extract_text: bool = True):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(url, wait_until="domcontentloaded", timeout=30000)
        title = page.title()
        content = page.inner_text("body") if extract_text else ""
        browser.close()
    return {
        "url": url,
        "title": title,
        "content": content[:10000] if content else "",
        "content_truncated": len(content) > 10000 if content else False
    }
