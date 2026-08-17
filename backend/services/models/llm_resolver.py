import json
import logging
import re
from gradio_client import Client
from config.settings import settings  # type: ignore
from groq import Groq

logger = logging.getLogger(__name__)

def extract_json(text: str) -> str:
    match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if match:
        return match.group(1).strip()
    
    # Try to find raw JSON object
    text = text.strip()
    brace_start = text.find("{")
    if brace_start != -1:
        depth = 0
        for i in range(brace_start, len(text)):
            if text[i] == "{":
                depth += 1
            elif text[i] == "}":
                depth -= 1
                if depth == 0:
                    return text[brace_start:i + 1]
    return text

def resolve_via_fine_tuned_model(instruction: str) -> dict:
    """
    Calls the fine-tuned Llama model on Hugging Face Spaces via gradio_client.
    Expects the model to output a strict Composio WorkflowDAG schema.
    """
    logger.info(f"Calling fine-tuned model for instruction: {instruction}")
    
    # 1. Call HF Model
    try:
        client = Client("yp06/groit", token=settings.HF_TOKEN if settings.HF_TOKEN else None)
        raw_output = client.predict(instruction, api_name="/generate_dag")
        logger.info(f"HF Output received (length: {len(raw_output)})")
    except Exception as e:
        logger.error(f"Fine-tuned model route failed: {e}")
        raise ValueError(f"Hugging Face Space failed: {str(e)}")

    # 2. Parse directly from the HF model
    try:
        json_str = extract_json(raw_output)
        dag = json.loads(json_str)
        logger.info("Successfully parsed HF output directly as JSON.")
        return dag
    except Exception as parse_err:
        logger.error(f"Failed to parse HF output directly: {parse_err}")
        raise ValueError(f"Fine-tuned model returned invalid DAG JSON: {parse_err}")

def generate_dag_with_groq_fallback(instruction: str) -> dict:
    groq_client = Groq(api_key=settings.GROQ_API_KEY)
    system_prompt = """You are an agentic AI that plans workflows.
Given a user request, generate a strictly formatted JSON DAG workflow.
Use the following format:
{
  "workflow_name": "Short Descriptive Name",
  "nodes": [
    {
      "id": "node_1",
      "tool": "gmail", (e.g. gmail, slack, github, googlecalendar)
      "action": "SEND_EMAIL", (exact uppercase action name)
      "params": { ... },
      "depends_on": []
    }
  ]
}
RULES:
1. Output ONLY a valid JSON object.
2. Action MUST be ALL CAPS.
3. Infer the correct parameters required for the action.
"""
    try:
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            temperature=0.1,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": instruction}
            ]
        )
        json_str = extract_json(response.choices[0].message.content or "")
        return json.loads(json_str)
    except Exception as e:
        raise ValueError(f"Both HF and Groq fallback failed: {str(e)}")

def generate_dag_with_openrouter_fallback(instruction: str, system_prompt: str) -> dict:
    from openai import OpenAI
    openrouter_client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=settings.OPENROUTER_API_KEY
    )
    
    try:
        response = openrouter_client.chat.completions.create(
            model="openai/gpt-4o-mini",
            temperature=0.1,
            max_tokens=1000,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": instruction}
            ]
        )
        json_str = extract_json(response.choices[0].message.content) # type: ignore
        return json.loads(json_str)
    except Exception as e:
        raise ValueError(f"CRITICAL: All fallbacks (HF, Groq, OpenRouter) exhausted! Final error: {str(e)}")

def generate_dag(instruction: str) -> dict:
    try:
        return resolve_via_fine_tuned_model(instruction)
    except Exception as hf_e:
        logger.warning(f"Fine-tuned model failed ({hf_e}), falling back to Groq directly.")
        try:
            return generate_dag_with_groq_fallback(instruction)
        except Exception as groq_e:
            logger.warning(f"Groq API also failed ({groq_e}). Initiating final OpenRouter fallback!")
            system_prompt = """You are an agentic AI that plans workflows.
Given a user request, generate a strictly formatted JSON DAG workflow.
Use the following format:
{
  "workflow_name": "Short Descriptive Name",
  "nodes": [
    {
      "id": "node_1",
      "tool": "gmail",
      "action": "SEND_EMAIL",
      "params": { ... },
      "depends_on": []
    }
  ]
}
RULES:
1. Output ONLY a valid JSON object.
2. Action MUST be ALL CAPS.
3. Infer the correct parameters required for the action.
"""
            return generate_dag_with_openrouter_fallback(instruction, system_prompt)
