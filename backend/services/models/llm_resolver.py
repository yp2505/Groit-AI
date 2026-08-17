import json
import logging
import re
from gradio_client import Client
from config.settings import settings  # type: ignore
from groq import Groq

logger = logging.getLogger(__name__)

DAG_SYSTEM_PROMPT = """
You are an AI that converts user requests into JSON workflow DAGs.
You MUST output ONLY a valid JSON object with EXACTLY this structure — no extra text, no markdown:

{
  "workflow_name": "Short Name",
  "nodes": [
    {
      "id": "node_1",
      "tool": "gmail",
      "action": "SEND_EMAIL",
      "params": {"to": "user@example.com", "subject": "Hello", "body": "..."},
      "depends_on": []
    },
    {
      "id": "node_2",
      "tool": "slack",
      "action": "POST_MESSAGE",
      "params": {"channel": "#general", "message": "Done!"},
      "depends_on": ["node_1"]
    }
  ]
}

RULES:
1. Output ONLY the JSON object. No explanation, no markdown.
2. tool must be one of: gmail, slack, github, googlecalendar, notion
3. action must be ALL CAPS (e.g. SEND_EMAIL, POST_MESSAGE, CREATE_EVENT, CREATE_ISSUE)
4. Each node must have: id, tool, action, params, depends_on
5. workflow_name and nodes are REQUIRED at the top level.
"""

def validate_dag(dag: dict) -> dict:
    """Validate that the DAG has required top-level fields. Raises ValueError if invalid."""
    if "workflow_name" not in dag or "nodes" not in dag:
        raise ValueError(
            f"DAG missing required fields 'workflow_name' or 'nodes'. Got keys: {list(dag.keys())}"
        )
    if not isinstance(dag["nodes"], list) or len(dag["nodes"]) == 0:
        raise ValueError("DAG 'nodes' must be a non-empty list.")
    return dag

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
    except json.JSONDecodeError as parse_err:
        # Try a more aggressive extraction: find first { ... } block only
        try:
            brace_start = raw_output.find("{")
            if brace_start != -1:
                depth = 0
                for i in range(brace_start, len(raw_output)):
                    if raw_output[i] == "{":
                        depth += 1
                    elif raw_output[i] == "}":
                        depth -= 1
                        if depth == 0:
                            dag = json.loads(raw_output[brace_start:i + 1])
                            logger.info("Successfully parsed HF output via brace extraction.")
                            return dag
        except Exception:
            pass
        logger.error(f"Failed to parse HF output directly: {parse_err}")
        raise ValueError(f"Fine-tuned model returned invalid DAG JSON: {parse_err}")

def generate_dag_with_groq_fallback(instruction: str) -> dict:
    groq_client = Groq(api_key=settings.GROQ_API_KEY)
    try:
        response = groq_client.chat.completions.create(
            model="openai/gpt-oss-120b",
            temperature=0.1,
            messages=[
                {"role": "system", "content": DAG_SYSTEM_PROMPT},
                {"role": "user", "content": instruction}
            ]
        )
        json_str = extract_json(response.choices[0].message.content or "")
        return validate_dag(json.loads(json_str))
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
            return generate_dag_with_openrouter_fallback(instruction, DAG_SYSTEM_PROMPT)
