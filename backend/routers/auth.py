import os
import httpx
import logging
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse
from typing import Dict, Any

router = APIRouter(prefix="/auth", tags=["Authentication"])
logger = logging.getLogger("mcp_gateway.auth")

# Atlassian OAuth Config
CLIENT_ID = os.getenv("JIRA_CLIENT_ID")
CLIENT_SECRET = os.getenv("JIRA_CLIENT_SECRET")
REDIRECT_URI = os.getenv("JIRA_REDIRECT_URI", "http://localhost:8000/auth/jira/callback")

# Scopes required for Jira API
SCOPES = "read:jira-work write:jira-work offline_access"

# Slack Config
SLACK_CLIENT_ID = os.getenv("SLACK_CLIENT_ID")
SLACK_CLIENT_SECRET = os.getenv("SLACK_CLIENT_SECRET")
SLACK_REDIRECT_URI = os.getenv("SLACK_REDIRECT_URI", "http://localhost:8000/auth/slack/callback")

# Google Config
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/google/callback")

@router.get("/jira/login")
async def jira_login():
    """Redirect user to Atlassian for authorization."""
    if not CLIENT_ID:
        raise HTTPException(status_code=500, detail="JIRA_CLIENT_ID not configured")
    
    auth_url = (
        "https://auth.atlassian.com/authorize?"
        "audience=api.atlassian.com&"
        f"client_id={CLIENT_ID}&"
        f"scope={SCOPES}&"
        f"redirect_uri={REDIRECT_URI}&"
        "state=jira_state&"
        "response_type=code&"
        "prompt=consent"
    )
    return RedirectResponse(auth_url)

@router.get("/jira/callback")
async def jira_callback(code: str):
    """Handle the callback from Atlassian."""
    async with httpx.AsyncClient() as client:
        token_res = await client.post(
            "https://auth.atlassian.com/oauth/token",
            json={
                "grant_type": "authorization_code",
                "client_id": CLIENT_ID,
                "client_secret": CLIENT_SECRET,
                "code": code,
                "redirect_uri": REDIRECT_URI
            }
        )
        if token_res.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to exchange Jira code")
        
        token_data = token_res.json()
        access_token = token_data.get("access_token")
        
        resources_res = await client.get(
            "https://api.atlassian.com/oauth/token/accessible-resources",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        resources = resources_res.json()
        cloud_id = resources[0].get("id") if resources else None
        
        frontend_url = os.getenv("CORS_ORIGINS", "http://localhost:8080").split(",")[0].strip()
        return RedirectResponse(f"{frontend_url}/?jira_token={access_token}&jira_cloud_id={cloud_id}")

@router.get("/google/login")
async def google_login():
    """Redirect user to Google for authorization."""
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="GOOGLE_CLIENT_ID not configured")
    
    scopes = "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file"
    auth_url = (
        "https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={GOOGLE_CLIENT_ID}&"
        f"redirect_uri={GOOGLE_REDIRECT_URI}&"
        f"scope={scopes}&"
        "response_type=code&"
        "access_type=offline&"
        "prompt=consent"
    )
    return RedirectResponse(auth_url)

@router.get("/google/callback")
async def google_callback(code: str):
    """Handle the callback from Google."""
    async with httpx.AsyncClient() as client:
        token_res = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            }
        )
        if token_res.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to exchange Google code")
        
        token_data = token_res.json()
        access_token = token_data.get("access_token")
        
        frontend_url = os.getenv("CORS_ORIGINS", "http://localhost:8080").split(",")[0].strip()
        return RedirectResponse(f"{frontend_url}/?google_token={access_token}")

@router.get("/slack/login")
async def slack_login():
    """Redirect user to Slack for authorization."""
    if not SLACK_CLIENT_ID:
        raise HTTPException(status_code=500, detail="SLACK_CLIENT_ID not configured")
    
    # Bot scopes needed for automation
    scopes = "chat:write,channels:read,groups:read,im:read,mpim:read,channels:manage"
    auth_url = (
        "https://slack.com/oauth/v2/authorize?"
        f"client_id={SLACK_CLIENT_ID}&"
        f"scope={scopes}&"
        f"redirect_uri={SLACK_REDIRECT_URI}"
    )
    return RedirectResponse(auth_url)

@router.get("/slack/callback")
async def slack_callback(code: str):
    """Handle the callback from Slack."""
    async with httpx.AsyncClient() as client:
        token_res = await client.post(
            "https://slack.com/api/oauth.v2.access",
            data={
                "code": code,
                "client_id": SLACK_CLIENT_ID,
                "client_secret": SLACK_CLIENT_SECRET,
                "redirect_uri": SLACK_REDIRECT_URI,
            }
        )
        data = token_res.json()
        if not data.get("ok"):
            raise HTTPException(status_code=400, detail=f"Slack Auth Failed: {data.get('error')}")
        
        # We need the bot_access_token for robot automation
        access_token = data.get("access_token") 
        
        frontend_url = os.getenv("CORS_ORIGINS", "http://localhost:8080").split(",")[0].strip()
        return RedirectResponse(f"{frontend_url}/?slack_token={access_token}")
