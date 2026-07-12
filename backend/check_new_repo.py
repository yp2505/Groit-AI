import os
import httpx
import asyncio
from dotenv import load_dotenv

load_dotenv()

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
# User wants this repo
NEW_REPO = "GM-10/Agentic-MCP-Handled"

async def check_repo():
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "User-Agent": "Agentic-MCP-Gateway"
    }
    async with httpx.AsyncClient() as client:
        url = f"https://api.github.com/repos/{NEW_REPO}"
        print(f"Checking Repo: {url}")
        r = await client.get(url, headers=headers)
        if r.status_code == 200:
            data = r.json()
            print(f"✅ Found Repo: {data['full_name']}")
            print(f"Default Branch: {data['default_branch']}")
            return True
        else:
            print(f"❌ Error: {r.status_code} - {r.text}")
            return False

if __name__ == "__main__":
    asyncio.run(check_repo())
