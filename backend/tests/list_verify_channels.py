import os
from slack_sdk import WebClient
from dotenv import load_dotenv

# Load env
load_dotenv(override=True)
load_dotenv("../.env", override=True)

client = WebClient(token=os.getenv("SLACK_BOT_TOKEN"))

try:
    print("Checking Workspace Channels...")
    # List channels
    response = client.conversations_list(types="public_channel,private_channel")
    channels = response.get("channels", [])
    
    found = False
    print(f"Total Channels Bot can see: {len(channels)}")
    for channel in channels:
        if "verify-live" in channel["name"]:
            print(f"FOUND: #{channel['name']} (ID: {channel['id']}, Private: {channel['is_private']})")
            found = True
            
    if not found:
        print("No channels matching 'verify-live' found in the list.")
        
except Exception as e:
    print(f"Error: {e}")
