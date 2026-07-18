import asyncio
import os
import sys

# setup path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'backend')))
from services.integrations.composio_integration import get_composio_tools
from dotenv import load_dotenv

load_dotenv('backend/.env')

async def main():
    tools = await get_composio_tools("default", ["github"])
    print(f"Found {len(tools)} tools for github")
    if tools:
        print(tools[0])

asyncio.run(main())
