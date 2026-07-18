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
    1. Calls the fine-tuned Llama model on Hugging Face Spaces via gradio_client.
    2. Uses Groq as a fast schema-translation layer to ensure the output strictly 
       matches the Composio WorkflowDAG schema (tool, action, params).
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

    # 2. Translate using Groq API
    if not settings.GROQ_API_KEY or settings.GROQ_API_KEY == "your_groq_api_key_here":
        raise ValueError("GROQ_API_KEY is required to standardize the DAG schema for Composio.")

    system_prompt = """You are a schema translation layer. A fine-tuned model generated the following DAG output.
It may be invalid JSON, have missing brackets, or use keys like 'arguments' instead of 'params'. 
Your job is to translate it into the STRICT Composio Execution JSON structure:

{
  "workflow_name": "Short Descriptive Name",
  "nodes": [
    {
      "id": "node_1",
      "tool": "gmail", (e.g. gmail, slack, github, googlecalendar)
      "action": "SEND_EMAIL", (e.g. SEND_EMAIL, CREATE_EVENT, SEND_MESSAGE, CREATE_ISSUE)
      "params": { ... }, (rename 'arguments' or 'inputs' to 'params')
      "depends_on": []
    }
  ]
}

RULES:
1. Output ONLY a valid JSON object. No markdown blocks or explanations.
2. Infer the best exact Composio 'action' based on the tool and arguments. Action MUST be ALL CAPS.
3. If the input is cut off, intelligently complete the JSON structure.
"""

    try:
        groq_client = Groq(api_key=settings.GROQ_API_KEY)
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            temperature=0.1,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Instruction: {instruction}\n\nHF Output:\n{raw_output}"}
            ]
        )
        
        translated_json_str = extract_json(response.choices[0].message.content or "")
        translated_dag = json.loads(translated_json_str)
        logger.info("Successfully translated HF output via Groq.")
        return translated_dag
        
    except Exception as e:
        logger.error(f"Groq schema translation failed: {e}")
        raise ValueError(f"Failed to parse or translate DAG: {str(e)}")

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
