import asyncio
import os
from services.integrations.jira_integration import execute_jira
from dotenv import load_dotenv

load_dotenv()

async def raise_issue():
    print("Raising issue in Jira for project SCRUM...")
    params = {
        "summary": "Fix GitHub integration for new repo",
        "description": "Integration test: Raised for repository GM-10/Agentic-MCP-Handled",
        "priority": "High"
    }
    result = await execute_jira("create_issue", params)
    if result["status"] == "success":
        print(f"Success! Jira Issue Created: {result['output']['key']}")
        print(f"URL: {result['output']['url']}")
    else:
        print(f"Failed: {result.get('error')}")

if __name__ == "__main__":
    asyncio.run(raise_issue())
