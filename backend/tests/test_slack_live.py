import pytest
import os
import asyncio
from services.integrations.slack_integration import execute_slack

@pytest.mark.asyncio
async def test_slack_send_message_live():
    # Only run if SLACK_BOT_TOKEN is set to a real token (not the placeholder)
    token = os.getenv("SLACK_BOT_TOKEN")
    if not token or token == "xoxb-xxxxxxxxxxxxxxxx":
        pytest.skip("No real SLACK_BOT_TOKEN provided, skipping live test.")

    params = {
        "channel": os.getenv("SLACK_DEFAULT_CHANNEL", "#general"),
        "message": "Hello from Agentic MCP Gateway live test! :rocket:"
    }
    
    result = await execute_slack("send_message", params, {})
    assert result["status"] == "success"
    assert result["tool"] == "slack"
    assert result["action"] == "send_message"
    assert "output" in result

@pytest.mark.asyncio
async def test_slack_create_channel_live():
    token = os.getenv("SLACK_BOT_TOKEN")
    if not token or token == "xoxb-xxxxxxxxxxxxxxxx":
        pytest.skip("No real SLACK_BOT_TOKEN provided, skipping live test.")

    # Using a timestamp so the channel name is unique during test re-runs
    import time
    channel_name = f"test-channel-{int(time.time())}"
    
    params = {
        "name": channel_name
    }
    
    result = await execute_slack("create_channel", params, {})
    assert result["status"] == "success"
    assert result["tool"] == "slack"
    assert result["action"] == "create_channel"
    assert "output" in result
    assert result["output"]["channel"]["name"] == channel_name
