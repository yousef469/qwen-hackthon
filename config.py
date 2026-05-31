from openai import OpenAI
import os

API_KEY = os.getenv("QWEN_API_KEY", "sk-ws-H.HRIDLX.BujT.MEQCID1AShjlAiHQhBNUdmmbbsluJSaXDW49Li4lTlruEvVdAiA140GIle53DoXFpHVGO6fNmIw9qwP2G7YOZb-07gI6mg")
BASE_URL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"

client = OpenAI(api_key=API_KEY, base_url=BASE_URL)
