from tools.definitions import tool
from config import client
import sqlite3
import json
import time
import os

MEMORY_DB = os.path.join(os.path.dirname(__file__), "..", "memory.db")

def get_embedding(text: str):
    resp = client.embeddings.create(
        model="text-embedding-v4",
        input=text
    )
    return resp.data[0].embedding

@tool(
    name="store_memory",
    description="Store a fact or memory that should be remembered across conversations.",
    parameters={
        "type": "object",
        "properties": {
            "key": {
                "type": "string",
                "description": "A unique identifier or topic for this memory"
            },
            "content": {
                "type": "string",
                "description": "The fact or information to remember"
            },
            "category": {
                "type": "string",
                "description": "Category like user_preference, fact, instruction, summary",
                "default": "fact"
            }
        },
        "required": ["key", "content"]
    }
)
def store_memory(key: str, content: str, category: str = "fact"):
    conn = sqlite3.connect(MEMORY_DB)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS vector_memory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT UNIQUE,
            content TEXT,
            category TEXT,
            embedding BLOB,
            created_at REAL
        )
    """)
    emb = get_embedding(key + ": " + content)
    emb_blob = json.dumps(emb)
    conn.execute(
        "INSERT OR REPLACE INTO vector_memory (key, content, category, embedding, created_at) VALUES (?, ?, ?, ?, ?)",
        (key, content, category, emb_blob, time.time())
    )
    conn.commit()
    conn.close()
    return {"status": "stored", "key": key}

@tool(
    name="recall_memories",
    description="Search for relevant memories based on a query. Returns the most relevant stored facts.",
    parameters={
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "What to search for in memory"
            },
            "n": {
                "type": "integer",
                "description": "Number of results to return (max 10)",
                "default": 5
            }
        },
        "required": ["query"]
    }
)
def recall_memories(query: str, n: int = 5):
    conn = sqlite3.connect(MEMORY_DB)
    try:
        rows = conn.execute("SELECT key, content, category, embedding FROM vector_memory").fetchall()
    except:
        conn.close()
        return {"results": [], "note": "No memories stored yet"}

    query_emb = get_embedding(query)
    scored = []
    for key, content, category, emb_blob in rows:
        stored_emb = json.loads(emb_blob)
        score = cosine_similarity(query_emb, stored_emb)
        scored.append((score, key, content, category))

    scored.sort(reverse=True)
    conn.close()
    return {
        "results": [
            {"key": k, "content": c, "category": cat, "relevance": round(s, 3)}
            for s, k, c, cat in scored[:n]
        ]
    }

def cosine_similarity(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na = sum(x * x for x in a) ** 0.5
    nb = sum(x * x for x in b) ** 0.5
    return dot / (na * nb) if na and nb else 0
