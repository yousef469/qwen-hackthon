import sqlite3
import json
import time
from typing import Optional

DB_PATH = "memory.db"

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS user_profiles (
            session_id TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            updated_at REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS facts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            fact TEXT NOT NULL,
            category TEXT DEFAULT 'general',
            created_at REAL NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_conversations_session ON conversations(session_id);
        CREATE INDEX IF NOT EXISTS idx_facts_session ON facts(session_id);
    """)
    conn.commit()
    conn.close()

def save_message(session_id: str, role: str, content: str):
    conn = get_db()
    conn.execute(
        "INSERT INTO conversations (session_id, role, content, created_at) VALUES (?, ?, ?, ?)",
        (session_id, role, content, time.time())
    )
    conn.commit()
    conn.close()

def get_history(session_id: str, limit: int = 20) -> list:
    conn = get_db()
    rows = conn.execute(
        "SELECT role, content FROM conversations WHERE session_id = ? ORDER BY created_at ASC",
        (session_id,)
    ).fetchall()
    conn.close()
    return [{"role": r["role"], "content": r["content"]} for r in rows[-limit:]]

def save_profile(session_id: str, data: dict):
    conn = get_db()
    conn.execute(
        "INSERT OR REPLACE INTO user_profiles (session_id, data, updated_at) VALUES (?, ?, ?)",
        (session_id, json.dumps(data), time.time())
    )
    conn.commit()
    conn.close()

def get_profile(session_id: str) -> dict:
    conn = get_db()
    row = conn.execute(
        "SELECT data FROM user_profiles WHERE session_id = ?", (session_id,)
    ).fetchone()
    conn.close()
    return json.loads(row["data"]) if row else {}

def save_fact(session_id: str, fact: str, category: str = "general"):
    conn = get_db()
    conn.execute(
        "INSERT INTO facts (session_id, fact, category, created_at) VALUES (?, ?, ?, ?)",
        (session_id, fact, category, time.time())
    )
    conn.commit()
    conn.close()

def get_facts(session_id: str) -> list:
    conn = get_db()
    rows = conn.execute(
        "SELECT fact, category FROM facts WHERE session_id = ? ORDER BY created_at ASC",
        (session_id,)
    ).fetchall()
    conn.close()
    return [{"fact": r["fact"], "category": r["category"]} for r in rows]
