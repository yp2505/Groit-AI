import asyncio
import os
import sys
import uuid

# Add current directory to path
sys.path.insert(0, os.getcwd())

from services.executor import ExecutionBridge
from models.dag import WorkflowDAG, DAGNode
from dotenv import load_dotenv

async def test_bug_fixed_flow():
    # Load env
    load_dotenv(override=True)
    load_dotenv("../.env", override=True)

    # 1. Define a 2-step DAG: Simulating finding a bug then posting the fix update
    bug_id = f"BUG-{uuid.uuid4().hex[:4].upper()}"
    
    dag = WorkflowDAG(
        workflow_name="Bug Fix Announcement",
        nodes=[
            # We'll use a mock Jira node to 'get' the bug info
            DAGNode(
                id="jira_bug",
                tool="jira",
                action="get_issue",
                params={"issue_id": bug_id},
                mock_output={
                    "issue_key": bug_id,
                    "summary": "Critical Login Failure in Production",
                    "status": "Fixed"
                },
                depends_on=[]
            ),
            # Post the update to Slack
            DAGNode(
                id="notify_fix",
                tool="slack",
                action="send_message",
                params={
                    "channel": "#all-daiict", 
                    "message": (
                        f"✅ *Bug Fixed by Agentic MCP* \n\n"
                        f"🆔 *Issue*: `{{{{jira_bug.output.issue_key}}}}` \n"
                        f"📝 *Summary*: {{{{jira_bug.output.summary}}}} \n"
                        f"🚀 *Action*: Patch applied and verified automatically. \n"
                        f"🔔 *Status*: Ticket moved to **DONE**."
                    )
                },
                depends_on=["jira_bug"]
            )
        ]
    )

    print(f"[START] Bug Fix Announcement Test ({bug_id})...")
    bridge = ExecutionBridge(dag)
    result = await bridge.run()

    if result.succeeded == 2:
        print("\n[SUCCESS] Bug fix announcement posted to #all-daiict!")
    else:
        print(f"\n[FAIL] Workflow failed. (Succeeded: {result.succeeded}/2)")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(test_bug_fixed_flow())
