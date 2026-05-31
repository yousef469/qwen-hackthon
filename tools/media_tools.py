from tools.definitions import tool
from config import API_KEY
import httpx
import base64
import json

@tool(
    name="generate_image",
    description="Generate an image from a text description using Qwen-Image 2.0 Pro. Use this when the user asks you to create, generate, make, or draw an image. Returns the image as base64 PNG data.",
    parameters={
        "type": "object",
        "properties": {
            "prompt": {
                "type": "string",
                "description": "Detailed description of the image to generate. Be specific about style, colors, composition, and mood."
            },
            "size": {
                "type": "string",
                "description": "Image size (default: 1024*1024)",
                "enum": ["1024*1024", "1280*720", "720*1280"],
                "default": "1024*1024"
            }
        },
        "required": ["prompt"]
    }
)
def generate_image(prompt: str, size: str = "1024*1024"):
    url = "https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation"
    payload = {
        "model": "qwen-image-2.0-pro",
        "input": {
            "messages": [
                {"role": "user", "content": [{"text": prompt}]}
            ]
        },
        "parameters": {
            "negative_prompt": "Low quality, blurry, distorted, ugly, deformed",
            "prompt_extend": True,
            "watermark": False,
            "size": size,
            "n": 1,
        }
    }
    headers = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}
    resp = httpx.post(url, json=payload, headers=headers, timeout=120)
    resp.raise_for_status()
    data = resp.json()
    content_list = data.get("output", {}).get("choices", [{}])[0].get("message", {}).get("content", [])
    image_url = None
    for item in content_list:
        if "image" in item:
            image_url = item["image"]
            break
    if not image_url:
        return {"error": "No image returned from API"}
    img_resp = httpx.get(image_url, timeout=30)
    img_b64 = base64.b64encode(img_resp.content).decode()
    mime = img_resp.headers.get("content-type", "image/png")
    return {"image_b64": img_b64, "mime": mime, "prompt": prompt}


@tool(
    name="generate_video",
    description="Generate a video from a text description using Qwen Wan 2.7. Use this when the user asks you to create, generate, or make a video. Submits an async task and returns the task ID for polling. Videos take 2-5 minutes to generate.",
    parameters={
        "type": "object",
        "properties": {
            "prompt": {
                "type": "string",
                "description": "Detailed description of the video to generate. Describe scenes, camera movements, characters, and actions. Be specific about style and atmosphere."
            },
            "duration": {
                "type": "integer",
                "description": "Video duration in seconds (5-15)",
                "default": 10
            },
            "resolution": {
                "type": "string",
                "description": "Video resolution",
                "enum": ["720P", "1080P"],
                "default": "720P"
            }
        },
        "required": ["prompt"]
    }
)
def generate_video(prompt: str, duration: int = 10, resolution: str = "720P"):
    url = "https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis"
    payload = {
        "model": "wan2.7-t2v",
        "input": {
            "prompt": prompt,
            "negative_prompt": "Low quality, blurry, distorted, ugly, deformed"
        },
        "parameters": {
            "resolution": resolution,
            "ratio": "16:9",
            "prompt_extend": True,
            "watermark": False,
            "duration": min(max(duration, 5), 15),
        }
    }
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
        "X-DashScope-Async": "enable"
    }
    try:
        resp = httpx.post(url, json=payload, headers=headers, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        task_id = data.get("output", {}).get("task_id", "")
        status = data.get("output", {}).get("task_status", "PENDING")
        if not task_id:
            return {"error": f"Video API returned no task_id. Response: {str(data)[:200]}"}
        return {
            "task_id": task_id,
            "status": status,
            "message": f"Video generation task submitted. Task ID: {task_id}. Videos typically take 2-5 minutes to generate. Check status at /api/video-status/{task_id}."
        }
    except httpx.HTTPStatusError as e:
        body = e.response.text[:500]
        if "AllocationQuota" in body or "quota" in body.lower():
            return {"error": "The Wan video generation free quota has been exhausted. Enable paid billing in the Qwen Cloud console to continue using video generation.", "quota_exhausted": True}
        return {"error": f"Video API returned HTTP {e.response.status_code}: {body}"}
    except httpx.TimeoutException:
        return {"error": "Video API timed out. The service may be busy. Try a simpler prompt."}
    except Exception as e:
        return {"error": f"Video generation failed: {str(e)[:300]}"}
