import asyncio
import os
import sys
import json
import uuid

# Add current directory to path so we can import services and models
sys.path.insert(0, os.getcwd())

from services.executor import ExecutionBridge
from models.dag import WorkflowDAG, DAGNode
from services.audit import get_audit_logger

async def test_full_slack_flow():
    # 1. Define a 2-step DAG
    unique_suffix = uuid.uuid4().hex[:4]
    channel_name = f"verify-live-{unique_suffix}"
    
    dag = WorkflowDAG(
        workflow_name="Full Slack Verification",
        nodes=[
            DAGNode(
                id="create_chan",
                tool="slack",
                action="create_channel",
                params={"name": channel_name},
                depends_on=[]
            ),
            DAGNode(
                id="post_msg",
                tool="slack",
                action="send_message",
                # This tests template resolution: {{node_id.output.field}}
                params={
                    "channel": "{{create_chan.output.channel.id}}", 
                    "message": f"Step 2: Live resolution working! Channel Name: {channel_name}. ID: {{{{create_chan.output.channel.id}}}}"
                },
                depends_on=["create_chan"]
            ),
            DAGNode(
                id="announce",
                tool="slack",
                action="send_message",
                params={
                    "channel": "#all-daiict", 
                    "message": f"📢 *Agentic Announcement*: A new project channel has been created: <#{{{{create_chan.output.channel.id}}}}> (Name: {channel_name})"
                },
                depends_on=["create_chan"]
            )
        ]
    )

    print(f"[START] Full Slack Integration Test (Channel: {channel_name})...")
    
    bridge = ExecutionBridge(dag)
    result = await bridge.run()

    # 2. Check Results
    print(f"\nWorkflow Status: {result.status}")
    for node_id, res in result.node_results.items():
        print(f"  Node {node_id}: {res.status}")
        if res.output:
            # Print the exact ID returned by Slack
            if node_id == "create_chan":
                chan_id = res.output.get("channel", {}).get("id")
                print(f"    --> CREATED CHANNEL ID: {chan_id}")
            print(f"    Output Preview: {str(res.output)[:100]}...")
        if res.error:
            print(f"    Error: {res.error}")

    # 3. Verify SUCCESS
    if result.succeeded == 2:
        print("\n[PASS] MULTI-STEP FLOW")
    else:
        print(f"\n[FAIL] MULTI-STEP FLOW (Succeeded: {result.succeeded}/2)")
        sys.exit(1)

    # 4. Verify Audit Logs
    audit = get_audit_logger()
    logs = audit.get_all_logs()
    exec_logs = [l for l in logs if l.get('execution_id') == result.execution_id and l.get('tool') == 'slack']
    
    print(f"[OK] AUDIT TRAIL: {len(exec_logs)} Slack events recorded.")

if __name__ == "__main__":
    from dotenv import load_dotenv
    # Load backend default first
    load_dotenv(override=True)
    # Then override with root token if present
    load_dotenv("../.env", override=True)
        
    token = os.getenv("SLACK_BOT_TOKEN")
    if not token or token == "xoxb-xxxxxxxxxxxxxxxx":
        print("[ERROR] SLACK_BOT_TOKEN is placeholder. Check both backend/.env and Product/.env.")
        sys.exit(1)
        
    asyncio.run(test_full_slack_flow())
