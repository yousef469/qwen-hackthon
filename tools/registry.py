from tools.definitions import TOOL_DEFINITIONS, TOOL_HANDLERS

def get_tool_definitions():
    return TOOL_DEFINITIONS

def execute_tool(name: str, arguments: dict):
    handler = TOOL_HANDLERS.get(name)
    if not handler:
        return {"error": f"Tool '{name}' not found"}
    try:
        result = handler(**arguments)
        return {"result": result}
    except Exception as e:
        return {"error": str(e)}
