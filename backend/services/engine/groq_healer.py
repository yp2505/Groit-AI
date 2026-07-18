import json
import logging
from groq import Groq
from config.settings import settings
import re

logger = logging.getLogger(__name__)

def extract_json(text: str) -> str:
    match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if match:
        return match.group(1).strip()
    return text.strip()

def heal_params_with_groq(tool: str, action: str, failed_params: dict, error_message: str) -> dict:
    if not settings.GROQ_API_KEY or settings.GROQ_API_KEY == "your_groq_api_key_here":
        logger.warning("Groq API Key not found, skipping self-healing.")
        return failed_params

    system_prompt = f"""You are a recovery agent. A workflow node previously executed '{tool}.{action}'.
The execution failed with error: "{error_message}"
The parameters used were: {json.dumps(failed_params)}

Your job is to generate a fixed JSON payload of parameters for this tool and action so it succeeds.
Rules:
1. Output ONLY a valid JSON object representing the fixed 'params'.
2. Do not include markdown fences, explanations, or code blocks.
3. Fix the parameters based on the error message.
"""
    try:
        client = Groq(api_key=settings.GROQ_API_KEY)
        logger.info(f"[Self-Healing] Attempting to heal node {tool}.{action} after failure...")
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            max_tokens=512,
            messages=[{"role": "system", "content": system_prompt}]
        )
        raw = response.choices[0].message.content
        clean = extract_json(raw)
        return json.loads(clean)
    except Exception as e:
        logger.error(f"[Self-Healing] Failed to generate recovery params: {e}")
        return failed_params # fallback to original
