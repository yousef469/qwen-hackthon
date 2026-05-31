from tools.definitions import tool
import os

@tool(
    name="create_file",
    description="Create a file with the given content. Can create Python, SQL, HTML, JS, text files, etc.",
    parameters={
        "type": "object",
        "properties": {
            "path": {
                "type": "string",
                "description": "File path relative to workspace (e.g. 'output/script.py')"
            },
            "content": {
                "type": "string",
                "description": "Full file content to write"
            },
            "description": {
                "type": "string",
                "description": "Brief description of what this file does (for documentation)",
                "default": ""
            }
        },
        "required": ["path", "content"]
    }
)
def create_file(path: str, content: str, description: str = ""):
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w") as f:
        f.write(content)
    return {"status": "created", "path": os.path.abspath(path), "size": len(content)}

@tool(
    name="read_file",
    description="Read the contents of any file from the filesystem.",
    parameters={
        "type": "object",
        "properties": {
            "path": {
                "type": "string",
                "description": "Path to the file to read"
            }
        },
        "required": ["path"]
    }
)
def read_file(path: str):
    with open(path, "r") as f:
        content = f.read()
    return {"content": content, "size": len(content), "path": os.path.abspath(path)}

@tool(
    name="list_files",
    description="List files and directories in a given path.",
    parameters={
        "type": "object",
        "properties": {
            "path": {
                "type": "string",
                "description": "Directory path to list",
                "default": "."
            }
        },
        "required": []
    }
)
def list_files(path: str = "."):
    entries = os.listdir(path)
    items = []
    for e in sorted(entries):
        full = os.path.join(path, e)
        items.append({
            "name": e,
            "type": "directory" if os.path.isdir(full) else "file",
            "size": os.path.getsize(full) if os.path.isfile(full) else 0
        })
    return {"path": os.path.abspath(path), "items": items}
