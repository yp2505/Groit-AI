import asyncio
import os
import json
import logging
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("hello_integration_test")

# Load environment variables from backend/.env
load_dotenv()

# Import integration executors
try:
    from services.integrations.jira_integration import execute_jira
    from services.integrations.sheets_integration import execute_sheets
    from services.integrations.slack_integration import execute_slack
    from agentic_mcp_gateway.github_mcp import handle_github_tool
except ImportError as e:
    logger.error(f"Failed to import integration modules: {e}")
    logger.info("Ensure you are running this script from the 'backend' directory.")
    exit(1)

async def run_hello_test():
    print("\n" + "=" * 50)
    print("RUNNING 'HELLO' INTEGRATION TEST")
    print("=" * 50)
    
    results = {}

    # 1. Jira: Create "hello" todo
    print("\n[Step 1/4] Jira: Creating a 'hello' issue...")
    jira_res = await execute_jira("create_issue", {
        "summary": "hello",
        "description": "hello"
    })
    if jira_res["status"] == "success":
        issue_key = jira_res["output"]["key"]
        print(f"OK: Created Jira issue {issue_key}")
        results["Jira"] = f"SUCCESS ({issue_key})"
    else:
        print(f"FAILED Step 1: {jira_res.get('error')}")
        results["Jira"] = f"FAILED: {jira_res.get('error')}"

    # 2. GitHub: Create "hello" branch
    print("\n[Step 2/4] GitHub: Creating 'hello' branch...")
    repo_full = os.getenv("GITHUB_REPO", "preritashukla/Tic-Tech-Toe")
    # Adding a random suffix if "hello" exists might be safer, but user asked for "hello" branch
    # Let's try "hello" and if it fails because it exists, we'll note it.
    branch_name = "hello"
    try:
        github_res = await handle_github_tool("create_branch", {
            "repo_full_name": repo_full,
            "branch_name": branch_name,
            "from_branch": "main"
        })
        print(f"OK: Created GitHub branch '{branch_name}'")
        results["GitHub"] = f"SUCCESS ('{branch_name}')"
    except Exception as e:
        if "already exists" in str(e).lower():
            print(f"OK (Warning): GitHub branch '{branch_name}' already exists.")
            results["GitHub"] = "SUCCESS (Already Exists)"
        else:
            print(f"FAILED Step 2: {e}")
            results["GitHub"] = f"FAILED: {e}"
    
    # 3. Slack: Notify "hello"
    print("\n[Step 3/4] Slack: Sending 'hello' message...")
    slack_res = await execute_slack("send_message", {
        "message": "hello"
    })
    if slack_res["status"] == "success":
        print("OK: Slack 'hello' message sent.")
        results["Slack"] = "SUCCESS"
    else:
        print(f"FAILED Step 3: {slack_res.get('error')}")
        results["Slack"] = f"FAILED: {slack_res.get('error')}"

    # 4. Sheets: Log "hello"
    print("\n[Step 4/4] Google Sheets: Logging 'hello'...")
    log_data = {
        "Message": "hello",
        "Source": "Backend Test",
        "Status": "Verified"
    }
    sheets_res = await execute_sheets("append_row", {
        "row_data": log_data,
        "sheet_name": "Sheet1"
    })
    if sheets_res["status"] == "success":
        print("OK: 'hello' row appended to Google Sheets.")
        results["Sheets"] = "SUCCESS"
    else:
        print(f"FAILED Step 4: {sheets_res.get('error')}")
        results["Sheets"] = f"FAILED: {sheets_res.get('error')}"

    print("\n" + "=" * 50)
    print("HELLO TEST SUMMARY")
    print("=" * 50)
    for service, status in results.items():
        print(f"{service:15}: {status}")
    print("=" * 50)

if __name__ == "__main__":
    asyncio.run(run_hello_test())
