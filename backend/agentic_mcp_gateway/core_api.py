"""
main.py

The entry point. Wires up the simulated DAG, Logger, HITL, and Executor. 
"""

import asyncio
import sys

# Ensure UTF-8 output for emojis and box-drawing characters
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from .models import dag_from_dict
from .observability import ExecutionLogger
from .hitl import HITLGate
from .executor import DAGExecutor
from .agentic_executor import dispatch_mcp

EXAMPLE_DAG_JSON = {
    "workflow_id": "wf-20240409-login-bug",
    "description": "Handle login bug: Jira + GitHub + Slack",
    "nodes": [
        {
            "id": "task_1",
            "name": "Create Jira Ticket",
            "tool": "jira_mcp",
            "action": "create_ticket",
            "inputs": {
                "title": "Login Bug - Session Expiry",
                "priority": "High",
                "description": "Users are getting logged out unexpectedly after 5 minutes."
            },
            "depends_on": [],
            "requires_approval": False,
            "retry": { "max_attempts": 3, "backoff_factor": 2.0, "initial_delay": 0.5 }
        },
        {
            "id": "task_2",
            "name": "Link GitHub Issue",
            "tool": "github_mcp",
            "action": "link_issue",
            "inputs": {
                "issue_number": 42,
                "jira_ticket_id": "{{task_1.output.ticket_id}}"
            },
            "depends_on": ["task_1"],
            "requires_approval": False,
            "retry": { "max_attempts": 3, "backoff_factor": 2.0, "initial_delay": 0.5 }
        },
        {
            "id": "task_3",
            "name": "Notify Slack",
            "tool": "slack_mcp",
            "action": "post_message",
            "inputs": {
                "channel": "#engineering",
                "message": "🐛 Login bug ticket created! Ticket ID is {{task_1.output.ticket_id}}."
            },
            "depends_on": ["task_1", "task_2"],
            "requires_approval": True,
            "retry": { "max_attempts": 2, "backoff_factor": 1.5, "initial_delay": 0.5 }
        }
    ]
}

async def run_example():
    print("Initializing Agentic MCP Gateway...")
    
    # 1. Parse JSON to Python Data structures
    dag = dag_from_dict(EXAMPLE_DAG_JSON)
    
    # 2. Setup modules
    logger = ExecutionLogger(workflow_id=dag.workflow_id)
    hitl = HITLGate(logger=logger, auto_approve=True) # Change to True to bypass prompts in a demo
    
    # 3. Create executor
    executor = DAGExecutor(
        dag=dag,
        mcp_dispatcher=dispatch_mcp,
        hitl=hitl,
        logger=logger
    )
    
    # 4. Run!
    await executor.run()
    
    # 5. Review logs
    logger.print_summary()

if __name__ == "__main__":
    try:
        asyncio.run(run_example())
    except KeyboardInterrupt:
        print("\nProcess interrupted.")
