# Qwen function-calling tools
# Each tool has:
#   - definition: schema Qwen sees (name, description, parameters)
#   - handler: Python function that executes the tool

TOOL_DEFINITIONS = []
TOOL_HANDLERS = {}

def tool(name, description, parameters):
    """Decorator to register a tool."""
    def decorator(func):
        TOOL_DEFINITIONS.append({
            "type": "function",
            "function": {
                "name": name,
                "description": description,
                "parameters": parameters
            }
        })
        TOOL_HANDLERS[name] = func
        return func
    return decorator
