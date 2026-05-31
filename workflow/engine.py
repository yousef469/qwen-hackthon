import json
import uuid
import re

def sanitize_for_json(obj):
    if isinstance(obj, str):
        return re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', obj)
    if isinstance(obj, dict):
        return {k: sanitize_for_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [sanitize_for_json(v) for v in obj]
    return obj

WORKFLOWS = {
    "support": {
        "steps": [
            "triage",
            "resolve",
            "draft_response",
            "quality_check",
            "human_approval",
            "send"
        ],
        "description": "End-to-end customer support ticket handling"
    },
    "refund": {
        "steps": [
            "verify_purchase",
            "check_policy",
            "calculate_refund",
            "human_approval",
            "process_refund",
            "notify_customer"
        ],
        "description": "Refund processing workflow"
    }
}

STEP_LABELS = {
    "triage": "Classifying issue",
    "resolve": "Finding solution",
    "draft_response": "Drafting response",
    "quality_check": "Reviewing quality",
    "human_approval": "Awaiting your approval",
    "send": "Sending response",
    "verify_purchase": "Verifying purchase",
    "check_policy": "Checking policy",
    "calculate_refund": "Calculating refund",
    "process_refund": "Processing refund",
    "notify_customer": "Notifying customer"
}

STEP_ICONS = {
    "triage": "🔍",
    "resolve": "🔧",
    "draft_response": "✍️",
    "quality_check": "✅",
    "human_approval": "🙏",
    "send": "📤",
    "verify_purchase": "🔍",
    "check_policy": "📋",
    "calculate_refund": "💰",
    "process_refund": "⚙️",
    "notify_customer": "📧"
}


class WorkflowEngine:
    def __init__(self):
        self.active_workflows = {}
        self.agents = {}

    def register_agents(self, agents_dict: dict):
        self.agents = agents_dict

    def create_workflow(self, session_id: str, workflow_type: str = "support") -> dict:
        steps = list(WORKFLOWS[workflow_type]["steps"])
        self.active_workflows[session_id] = {
            "type": workflow_type,
            "current_step": 0,
            "steps": steps,
            "status": "in_progress",
            "data": {},
            "human_approval_needed": False,
            "session_id": session_id
        }
        return self.active_workflows[session_id]

    def get_workflow(self, session_id: str) -> dict:
        return self.active_workflows.get(session_id)

    def get_status(self, session_id: str) -> dict:
        wf = self.active_workflows.get(session_id)
        if not wf:
            return None
        step_idx = wf["current_step"]
        current_step = wf["steps"][step_idx] if step_idx < len(wf["steps"]) else None
        return {
            "workflow_id": session_id,
            "type": wf["type"],
            "current_step": current_step,
            "step_number": step_idx,
            "total_steps": len(wf["steps"]),
            "status": wf["status"],
            "needs_human": wf["human_approval_needed"],
            "data": wf["data"],
            "steps": wf["steps"]
        }

    def execute_step(self, session_id: str) -> dict:
        wf = self.active_workflows.get(session_id)
        if not wf or wf["status"] in ("completed", "rejected"):
            return None

        if wf["human_approval_needed"]:
            return None

        step = wf["steps"][wf["current_step"]]
        result = self._run_step(session_id, step)
        wf["data"][step] = result

        step_number = wf["current_step"]

        if step == "human_approval":
            wf["human_approval_needed"] = True
            wf["status"] = "awaiting_approval"
        else:
            wf["current_step"] += 1
            if wf["current_step"] >= len(wf["steps"]):
                wf["status"] = "completed"

        return {
            "step": step,
            "label": STEP_LABELS.get(step, step),
            "icon": STEP_ICONS.get(step, "📌"),
            "step_number": step_number,
            "total_steps": len(wf["steps"]),
            "result": result,
            "status": wf["status"],
            "needs_human": wf["human_approval_needed"]
        }

    def _run_step(self, session_id: str, step_name: str) -> dict:
        agent = self.agents.get(step_name)
        wf = self.active_workflows[session_id]

        context_parts = []
        for k, v in wf["data"].items():
            if isinstance(v, dict):
                output = v.get("output", str(v))
            else:
                output = str(v)
            context_parts.append(f"Step '{k}': {output[:500]}")

        context = "\n".join(context_parts)
        messages = [{"role": "user", "content": f"Execute workflow step: {step_name}\n\nPrevious context:\n{context}"}]

        if agent:
            try:
                output = agent.run(messages, context="")
                return {"output": output, "status": "completed"}
            except Exception as e:
                return {"output": f"Error: {str(e)}", "status": "error"}
        else:
            return {"output": f"Auto-completing step '{step_name}'", "status": "auto"}

    def approve(self, session_id: str) -> bool:
        wf = self.active_workflows.get(session_id)
        if wf and wf["human_approval_needed"]:
            wf["human_approval_needed"] = False
            wf["status"] = "in_progress"
            wf["data"]["human_approval"] = {"status": "approved"}
            wf["current_step"] += 1
            if wf["current_step"] >= len(wf["steps"]):
                wf["status"] = "completed"
            return True
        return False

    def reject(self, session_id: str, reason: str = "") -> bool:
        wf = self.active_workflows.get(session_id)
        if wf and wf["human_approval_needed"]:
            wf["human_approval_needed"] = False
            wf["status"] = "rejected"
            wf["data"]["human_approval"] = {"status": "rejected", "reason": reason}
            return True
        return False

    def can_execute_more(self, session_id: str) -> bool:
        wf = self.active_workflows.get(session_id)
        if not wf:
            return False
        return (wf["status"] == "in_progress" and
                wf["current_step"] < len(wf["steps"]) and
                not wf["human_approval_needed"])

    def execute_all_stream(self, session_id: str):
        while self.can_execute_more(session_id):
            result = self.execute_step(session_id)
            if not result:
                break

            yield f"data: {json.dumps(sanitize_for_json({
                'type': 'workflow_step',
                'step': result['step'],
                'label': result['label'],
                'icon': result['icon'],
                'step_number': result['step_number'],
                'total_steps': result['total_steps'],
                'result': result['result'],
                'status': result['status']
            }))}\n\n"

            if result.get("needs_human"):
                yield f"data: {json.dumps(sanitize_for_json({
                    'type': 'approval_request',
                    'step': result['step'],
                    'label': result['label'],
                    'icon': result['icon'],
                    'workflow_id': session_id,
                    'reason': 'Human approval required before proceeding',
                    'data': result['result']
                }))}\n\n"
                return

        status = self.get_status(session_id)
        if status and status["status"] == "completed":
            yield f"data: {json.dumps({'type': 'workflow_complete', 'workflow_id': session_id})}\n\n"
        elif status and status["status"] == "in_progress":
            yield f"data: {json.dumps({'type': 'workflow_idle', 'workflow_id': session_id})}\n\n"


workflow_engine = WorkflowEngine()
