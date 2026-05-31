_usage: dict[str, dict] = {}
CONTEXT_LIMITS = {
    "qwen-plus": 131072,
    "qwen3.5-omni-plus": 32768,
}

def add(session_id: str, prompt: int, completion: int, model: str = "qwen-plus"):
    if session_id not in _usage:
        _usage[session_id] = {"prompt": 0, "completion": 0, "total": 0, "limit": CONTEXT_LIMITS.get(model, 32768)}
    _usage[session_id]["prompt"] += prompt
    _usage[session_id]["completion"] += completion
    _usage[session_id]["total"] += prompt + completion

def get(session_id: str) -> dict:
    return _usage.get(session_id, {"prompt": 0, "completion": 0, "total": 0, "limit": 32768})

def reset(session_id: str):
    _usage.pop(session_id, None)

def estimate_tokens(text: str) -> int:
    return max(1, len(text) // 4)
