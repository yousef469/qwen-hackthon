from config import client
from memory import store

MEMORY_SUMMARIZER_PROMPT = """Analyze the conversation and extract ONLY confirmed personal facts about the user.
Extract:
1. Personal facts: name, age, job, company, location, contact info
2. Preferences: language, tone, formatting preferences
3. Confirmed context: project name, team, timeline, specific requirements

STRICT RULES:
- ONLY extract facts that are explicitly stated and confirmed
- Do NOT save conversational fillers, opinions, or temporary statements
- Each fact must be specific and verifiable from the conversation
- Skip vague statements like "I like this" or "that sounds good"
- Minimum fact length: 15 characters
- Maximum 10 facts per extraction

Return as a bullet list of facts to remember."""

EXTRACTION_PROMPT = """Based on this conversation, extract structured user profile information.
ONLY include confirmed facts — not speculation or temporary statements.
Return a JSON object with these possible fields (omit what's not known):
- name
- age
- job_title
- company
- location
- preferences
- language
- project_name
- team_size
- timeline"""

def summarize_and_extract(session_id: str, history: list):
    if len(history) < 4:
        return

    conv_text = "\n".join(f"{m['role']}: {m['content']}" for m in history[-6:])

    facts_resp = client.chat.completions.create(
        model="qwen-plus",
        messages=[
            {"role": "system", "content": MEMORY_SUMMARIZER_PROMPT},
            {"role": "user", "content": conv_text}
        ]
    )
    facts_text = facts_resp.choices[0].message.content
    for line in facts_text.split("\n"):
        line = line.strip().strip("- ")
        if line and len(line) > 10:
            store.save_fact(session_id, line)

    profile_resp = client.chat.completions.create(
        model="qwen-plus",
        messages=[
            {"role": "system", "content": EXTRACTION_PROMPT},
            {"role": "user", "content": conv_text}
        ]
    )
    import json
    try:
        profile = json.loads(profile_resp.choices[0].message.content)
        existing = store.get_profile(session_id)
        existing.update(profile)
        store.save_profile(session_id, existing)
    except:
        pass

def build_memory_context(session_id: str) -> str:
    profile = store.get_profile(session_id)
    facts = store.get_facts(session_id)

    parts = []
    if profile:
        parts.append("User Profile:")
        for k, v in profile.items():
            parts.append(f"- {k}: {v}")

    if facts:
        parts.append("Known Facts:")
        for f in facts:
            parts.append(f"- [{f['category']}] {f['fact']}")

    return "\n".join(parts) if parts else ""
