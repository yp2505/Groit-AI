import os
import httpx
import asyncio
from dotenv import load_dotenv

load_dotenv()

JIRA_BASE_URL = os.environ.get("JIRA_BASE_URL", "").rstrip("/")
JIRA_EMAIL = os.environ.get("JIRA_EMAIL", "").strip()
JIRA_API_TOKEN = os.environ.get("JIRA_API_TOKEN", "").strip()

async def get_issue(issue_key):
    auth = (JIRA_EMAIL, JIRA_API_TOKEN)
    headers = {"Accept": "application/json"}
    
    async with httpx.AsyncClient() as client:
        url = f"{JIRA_BASE_URL}/rest/api/3/issue/{issue_key}"
        print(f"Fetching Issue: {url}")
        
        r = await client.get(url, auth=auth, headers=headers)
        if r.status_code == 200:
            data = r.json()
            print(f"✅ Found Issue: {data['key']}")
            print(f"Summary: {data['fields']['summary']}")
            print(f"Status: {data['fields']['status']['name']}")
            print(f"Project: {data['fields']['project']['name']} ({data['fields']['project']['key']})")
        else:
            print(f"❌ Error: {r.status_code} - {r.text}")

if __name__ == "__main__":
    # In my last run, SCRUM-8 was reported as created
    asyncio.run(get_issue("SCRUM-8"))
