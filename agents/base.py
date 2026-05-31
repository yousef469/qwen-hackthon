import json
from config import client
from tools.registry import get_tool_definitions, execute_tool
import tracker

class BaseAgent:
    def __init__(self, name: str, system_prompt: str, model: str = "qwen3.5-omni-plus"):
        self.name = name
        self.system_prompt = system_prompt
        self.model = model
        self.tools = get_tool_definitions()

    def run(self, messages: list, context: str = "") -> str:
        full_messages = self._build_messages(messages, context)
        resp = client.chat.completions.create(
            model=self.model,
            messages=full_messages,
            tools=self.tools if self.tools else None,
            tool_choice="auto"
        )
        msg = resp.choices[0].message
        if msg.tool_calls:
            full_messages = self._execute_tool_calls(msg, full_messages)
            final = client.chat.completions.create(model=self.model, messages=full_messages)
            return final.choices[0].message.content
        return msg.content

    def run_stream(self, messages: list, context: str = ""):
        full_messages = self._build_messages(messages, context)

        resp = client.chat.completions.create(
            model=self.model,
            messages=full_messages,
            tools=self.tools if self.tools else None,
            tool_choice="auto",
            stream=True,
        )

        tool_calls_buffer = {}

        for chunk in resp:
            delta = chunk.choices[0].delta if chunk.choices else None
            if delta is None:
                continue

            if delta.tool_calls:
                for tc in delta.tool_calls:
                    idx = tc.index
                    if idx not in tool_calls_buffer:
                        tool_calls_buffer[idx] = {"id": tc.id, "name": "", "args": ""}
                    if tc.id:
                        tool_calls_buffer[idx]["id"] = tc.id
                    if tc.function and tc.function.name:
                        tool_calls_buffer[idx]["name"] += tc.function.name
                    if tc.function and tc.function.arguments:
                        tool_calls_buffer[idx]["args"] += tc.function.arguments

            if delta.content:
                yield f"data: {json.dumps({'type': 'token', 'content': delta.content})}\n\n"

        if tool_calls_buffer:
            yield f"data: {json.dumps({'type': 'tools_start'})}\n\n"

            # Build the assistant message with tool_calls (required by API format)
            assistant_tc = []
            for idx in sorted(tool_calls_buffer.keys()):
                tc = tool_calls_buffer[idx]
                assistant_tc.append({
                    "id": tc['id'],
                    "type": "function",
                    "function": {"name": tc['name'], "arguments": tc['args']}
                })
            full_messages.append({
                "role": "assistant",
                "content": None,
                "tool_calls": assistant_tc
            })

            for idx in sorted(tool_calls_buffer.keys()):
                tc = tool_calls_buffer[idx]
                yield f"data: {json.dumps({'type': 'tool_call', 'name': tc['name'], 'args': tc['args']})}\n\n"
                try:
                    args = json.loads(tc['args']) if tc['args'] else {}
                    result = execute_tool(tc['name'], args)
                except Exception as e:
                    result = {"error": str(e)}

                # For the LLM's second call, strip heavy binary data to stay under input limits
                llm_result = result
                if isinstance(result, dict):
                    inner = result.get("result", result)
                    if isinstance(inner, dict):
                        if "image_b64" in inner and isinstance(inner["image_b64"], str) and len(inner["image_b64"]) > 500:
                            inner = {**inner, "image_b64": f"[image data: {len(inner['image_b64'])} base64 chars]", "note": "Image generated successfully. Displayed to user above."}
                            llm_result = {"result": inner}

                full_messages.append({
                    "role": "tool",
                    "tool_call_id": tc['id'],
                    "content": json.dumps(llm_result)
                })
                yield f"data: {json.dumps({'type': 'tool_result', 'name': tc['name'], 'result': result})}\n\n"

            yield f"data: {json.dumps({'type': 'tools_end'})}\n\n"

            final = client.chat.completions.create(
                model=self.model,
                messages=full_messages,
                stream=True,
            )
            for chunk in final:
                if chunk.choices and chunk.choices[0].delta:
                    d = chunk.choices[0].delta
                    if d.content:
                        yield f"data: {json.dumps({'type': 'token', 'content': d.content})}\n\n"

        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    def run_with_tools(self, messages: list, context: str = "") -> tuple[str, list]:
        full_messages = self._build_messages(messages, context)
        resp = client.chat.completions.create(
            model=self.model,
            messages=full_messages,
            tools=self.tools if self.tools else None,
            tool_choice="auto"
        )
        msg = resp.choices[0].message
        calls = []
        if msg.tool_calls:
            full_messages = self._execute_tool_calls(msg, full_messages, calls)
            final = client.chat.completions.create(model=self.model, messages=full_messages)
            return final.choices[0].message.content, calls
        return msg.content, calls

    def _build_messages(self, messages, context=""):
        result = [{"role": "system", "content": self.system_prompt}]
        if context:
            result.append({"role": "system", "content": f"Context:\n{context}"})
        result.extend(messages)
        return result

    def _execute_tool_calls(self, msg, full_messages, calls_list=None):
        for tc in msg.tool_calls:
            fn = tc.function
            if calls_list is not None:
                calls_list.append({"tool": fn.name, "arguments": json.loads(fn.arguments)})
            result = execute_tool(fn.name, json.loads(fn.arguments))
            full_messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": json.dumps(result)
            })
        return full_messages
