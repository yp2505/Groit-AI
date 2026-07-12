import os
import httpx
import asyncio
from dotenv import load_dotenv

load_dotenv()

JIRA_BASE_URL = os.environ.get("JIRA_BASE_URL", "").rstrip("/")
JIRA_EMAIL = os.environ.get("JIRA_EMAIL", "").strip()
JIRA_API_TOKEN = os.environ.get("JIRA_API_TOKEN", "").strip()
PROJECT_KEY = os.environ.get("JIRA_PROJECT_KEY", "SCRUM")

async def list_issues():
    auth = (JIRA_EMAIL, JIRA_API_TOKEN)
    headers = {"Accept": "application/json"}
    
    async with httpx.AsyncClient() as client:
        # Search for issues in the project
        url = f"{JIRA_BASE_URL}/rest/api/3/search?jql=project='{PROJECT_KEY}'"
        print(f"Listing Issues in Project {PROJECT_KEY}...")
        
        r = await client.get(url, auth=auth, headers=headers)
        if r.status_code == 200:
            data = r.json()
            issues = data.get("issues", [])
            print(f"Total Issues Found: {len(issues)}")
            for issue in issues:
                print(f"- {issue['key']}: {issue['fields']['summary']} [{issue['fields']['status']['name']}]")
        else:
            print(f"FAILED: Error: {r.status_code} - {r.text}")

if __name__ == "__main__":
    asyncio.run(list_issues())
