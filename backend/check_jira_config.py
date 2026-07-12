import os
import httpx
import asyncio
from dotenv import load_dotenv

load_dotenv()

JIRA_BASE_URL = os.environ.get("JIRA_BASE_URL", "").rstrip("/")
JIRA_EMAIL = os.environ.get("JIRA_EMAIL", "").strip()
JIRA_API_TOKEN = os.environ.get("JIRA_API_TOKEN", "").strip()
PROJECT_KEY = os.environ.get("JIRA_PROJECT_KEY", "SCRUM")

async def check_project_details():
    auth = (JIRA_EMAIL, JIRA_API_TOKEN)
    headers = {"Accept": "application/json"}
    
    async with httpx.AsyncClient() as client:
        # 1. Check Project
        url = f"{JIRA_BASE_URL}/rest/api/3/project/{PROJECT_KEY}"
        print(f"Checking Project: {PROJECT_KEY} at {url}")
        
        r = await client.get(url, auth=auth, headers=headers)
        if r.status_code == 200:
            proj = r.json()
            print(f"Project Found: {proj['name']} ({proj['key']})")
            print(f"Issue Types available in project summary: {[it['name'] for it in proj.get('issueTypes', [])]}")
        else:
            print(f"Error getting project {PROJECT_KEY}: {r.status_code} - {r.text}")

        # 2. Check Create Issue Meta
        url = f"{JIRA_BASE_URL}/rest/api/3/issue/createmeta?projectKeys={PROJECT_KEY}&expand=projects.issuetypes.fields"
        print(f"\nChecking Create Metadata: {url}")
        r = await client.get(url, auth=auth, headers=headers)
        if r.status_code == 200:
            meta = r.json()
            projects = meta.get("projects", [])
            if projects:
                for p in projects:
                    print(f"Project: {p['key']}")
                    for it in p.get("issuetypes", []):
                        print(f"  - Issue Type: {it['name']} (ID: {it['id']})")
            else:
                print("No project metadata returned. This often means you don't have CREATE permission.")
        else:
            print(f"Error getting metadata: {r.status_code} - {r.text}")

if __name__ == "__main__":
    asyncio.run(check_project_details())
