import os, httpx, asyncio, json; from dotenv import load_dotenv; 
load_dotenv(); 

async def l(): 
    auth=(os.getenv('JIRA_EMAIL').strip(), os.getenv('JIRA_API_TOKEN').strip())
    async with httpx.AsyncClient() as client:
        r=await client.get(os.getenv('JIRA_BASE_URL').rstrip('/')+'/rest/api/3/project', auth=auth)
        print(json.dumps(r.json(), indent=2))

if __name__ == "__main__":
    asyncio.run(l())
