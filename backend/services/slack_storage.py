import json
import os
from datetime import datetime
from typing import List, Dict, Any

SLACK_HISTORY_FILE = "slack_history.json"

class SlackStorage:
    def __init__(self, storage_path: str = SLACK_HISTORY_FILE):
        self.storage_path = storage_path
        if not os.path.exists(self.storage_path):
            with open(self.storage_path, "w") as f:
                json.dump([], f)

    def add_message(self, channel: str, text: str, sender: str = "Agentic MCP") -> Dict[str, Any]:
        message = {
            "id": os.urandom(4).hex(),
            "channel": channel,
            "text": text,
            "sender": sender,
            "timestamp": datetime.now().isoformat()
        }
        
        history = self.get_history()
        history.append(message)
        
        with open(self.storage_path, "w") as f:
            json.dump(history, f, indent=2)
            
        return message

    def get_history(self) -> List[Dict[str, Any]]:
        try:
            with open(self.storage_path, "r") as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            return []

    def get_channels(self) -> List[str]:
        history = self.get_history()
        # Always include defaults
        channels = {"#general", "#dev", "#hackathon-dev", "#alerts"}
        for msg in history:
            channels.add(msg.get("channel", "#general"))
        return sorted(list(channels))

# Global instance
slack_storage = SlackStorage()
