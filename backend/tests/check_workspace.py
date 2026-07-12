import os
from slack_sdk import WebClient
from dotenv import load_dotenv
import sys

# Load backend default (placeholder) first, then override with root (real) token
load_dotenv(override=True)
load_dotenv("../.env", override=True)

client = WebClient(token=os.getenv("SLACK_BOT_TOKEN"))

try:
    auth_test = client.auth_test()
    team_name = auth_test.get("team")
    bot_name = auth_test.get("user")
    print(f"Token is for Workspace: {team_name}")
    print(f"Bot Name: {bot_name}")
except Exception as e:
    print(f"Error: {e}")
