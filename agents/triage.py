from agents.base import BaseAgent

TRIAGE_PROMPT = """You are a Triage Agent. Classify incoming customer inquiries.
Determine:
1. Category: bug_report / feature_request / billing / account / general
2. Urgency: low / medium / high / critical
3. Sentiment: negative / neutral / positive
4. Summary: one-line summary of the issue

Respond ONLY with a JSON object containing these fields."""

class TriageAgent(BaseAgent):
    def __init__(self):
        super().__init__("triage", TRIAGE_PROMPT)
