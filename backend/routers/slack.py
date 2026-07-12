from fastapi import APIRouter
from services.slack_storage import slack_storage
from typing import List, Dict, Any

router = APIRouter(prefix="/slack", tags=["Slack Dashboard"])

@router.get("/messages", response_model=List[Dict[str, Any]])
async def get_messages():
    """Retrieve all logged Slack messages."""
    return slack_storage.get_history()

@router.get("/channels", response_model=List[str])
async def get_channels():
    """Retrieve all identified Slack channels."""
    return slack_storage.get_channels()
