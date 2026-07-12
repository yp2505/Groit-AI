# prompt_engine.py
from groq import Groq
from dotenv import load_dotenv
import json
import re
import os

load_dotenv()

from prompts.system_prompt import SYSTEM_PROMPT

def validate_dag(dag: dict) -> list[str]:
    errors = []
    if "workflow_name" not in dag and "name" not in dag and "title" not in dag:
        errors.append("Missing 'workflow_name', 'name', or 'title'")
    
    steps = dag.get("steps") or dag.get("nodes")
    if not isinstance(steps, list):
        errors.append("Missing or invalid 'steps' or 'nodes' array")
        return errors
    if len(steps) == 0:
        errors.append("DAG has no steps")
        return errors

    node_ids = {n.get("id") for n in steps}
    for i, node in enumerate(steps):
        prefix = f"Step {i+1} ({node.get('id', '?')})"
        if "id" not in node:
            errors.append(f"{prefix}: missing 'id'")
        
        # Flexibly check for either new or old schema
        has_tool_action = "tool" in node and ("action" in node or "." in str(node.get("tool")))
        has_service_tool = "service" in node and "tool" in node
        
        if not (has_tool_action or has_service_tool):
            errors.append(f"{prefix}: missing service/tool/action definition")
            
        if "params" not in node and "inputs" not in node:
            errors.append(f"{prefix}: missing 'params' or 'inputs'")
            
        for dep in node.get("depends_on", []):
            if dep not in node_ids:
                errors.append(f"{prefix}: depends_on references unknown id '{dep}'")
    return errors

def extract_json(text: str) -> str:
    match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if match:
        return match.group(1).strip()
    return text.strip()

def generate_dag(user_input: str, retries: int = 2) -> dict:
    last_error = None

    for attempt in range(1, retries + 2):
        try:
            print(f"[Attempt {attempt}] Calling Groq API...")
            client = Groq()  # reads GROQ_API_KEY from env

            model = os.getenv("LLM_MODEL", "llama-3.1-8b-instant")
            response = client.chat.completions.create(
                model=model,
                max_tokens=1024,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_input}
                ]
            )

            raw = response.choices[0].message.content
            clean = extract_json(raw)

            try:
                dag = json.loads(clean)
            except json.JSONDecodeError as e:
                last_error = f"Invalid JSON: {e}\nRaw output:\n{raw}"
                print(f"[Attempt {attempt}] JSON parse failed: {e}")
                continue

            errors = validate_dag(dag)
            if errors:
                last_error = f"Validation errors: {errors}"
                print(f"[Attempt {attempt}] Validation failed: {errors}")
                continue

            print(f"[Attempt {attempt}] ✅ DAG valid!")
            return dag

        except Exception as e:
            if "429" in str(e):
                last_error = "Groq Rate Limit Exceeded. Please wait a few minutes or switch to a high-capacity model."
            else:
                last_error = f"Unexpected error: {e}"
            break

    print(f"[generate_dag] All attempts failed. Last error: {last_error}")
    return {
        "workflow_name": "fallback_manual_review",
        "description": f"Workflow failed to generate: {last_error}",
        "error": last_error,
        "nodes": []
    }

def generate_recovery_params(tool: str, action: str, failed_inputs: dict, error_message: str, original_prompt: str) -> dict:
    system_prompt = f"""You are a recovery agent. A workflow node previously executed '{tool}.{action}'.
The original goal was: "{original_prompt}"
The execution failed with error: "{error_message}"
The parameters used were: {json.dumps(failed_inputs)}

Your job is to generate a fixed JSON payload of parameters for this tool and action so it succeeds.
Rules:
1. Output ONLY a valid JSON object representing the fixed 'params'.
2. Do not include markdown fences, explanations, or code blocks.
3. Fix the parameters based on the error message.
"""
    try:
        client = Groq()
        print(f"[Self-Healing] Attempting to heal node {tool}.{action} after failure...")
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            max_tokens=512,
            messages=[{"role": "system", "content": system_prompt}]
        )
        raw = response.choices[0].message.content
        clean = extract_json(raw)
        return json.loads(clean)
    except Exception as e:
        print(f"[Self-Healing] Failed to generate recovery params: {e}")
        return failed_inputs # fallback to original

TEST_CASES = [
    "Critical bug filed in Jira -> Create GitHub branch -> Notify Slack -> Update incident tracker",
    "Get repository info",
    "Fetch stats for octocat/Spoon-Knife",
    "Create a new Jira ticket for a login bug",
    "Fix is merged on GitHub, now close the Jira ticket and notify the team on Slack",
]

if __name__ == "__main__":
    for i, test in enumerate(TEST_CASES, 1):
        print(f"\n{'='*60}")
        print(f"TEST {i}: {test}")
        print('='*60)
        dag = generate_dag(test)
        print(json.dumps(dag, indent=2))