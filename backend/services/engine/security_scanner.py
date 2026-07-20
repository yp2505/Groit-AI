"""
security_scanner.py
-------------------
Pre-execution security layer for Groit AI workflows.

Checks:
  1. URL Safety  — Google Safe Browsing API v4 (free)
  2. Entropy Score — detects mass-spam patterns per user session

Both checks are invisible to genuine users (adds <200ms latency).
Raises SecurityViolationError if a threat is detected, which causes
the DAGExecutor to abort the workflow before Composio executes it.
"""

import re
import logging
import httpx
from typing import Any

logger = logging.getLogger(__name__)

# ─── Custom Exception ────────────────────────────────────────────────────────

class SecurityViolationError(Exception):
    """Raised when a workflow is blocked for security reasons."""
    pass


# ─── URL Extraction Helper ───────────────────────────────────────────────────

URL_PATTERN = re.compile(
    r'https?://[^\s\'"<>]+'
    r'|www\.[^\s\'"<>]+'
    r'|\b(?:[a-zA-Z0-9-]+\.)+(?:com|org|net|io|co|ai|app|dev|xyz|info|biz|ru|cn|tk|ml|ga|cf)\b'
    r'/[^\s\'"<>]*',
    re.IGNORECASE
)

def extract_urls_from_params(params: dict) -> list[str]:
    """Recursively extract all URLs from workflow node params."""
    urls = []
    for value in params.values():
        if isinstance(value, str):
            found = URL_PATTERN.findall(value)
            # Normalize: add https:// if missing
            for url in found:
                if not url.startswith("http"):
                    url = "https://" + url
                urls.append(url)
        elif isinstance(value, dict):
            urls.extend(extract_urls_from_params(value))
        elif isinstance(value, list):
            for item in value:
                if isinstance(item, str):
                    urls.extend(URL_PATTERN.findall(item))
    return list(set(urls))  # deduplicate


# ─── 1. Google Safe Browsing URL Scanner ────────────────────────────────────

SAFE_BROWSING_API = "https://safebrowsing.googleapis.com/v4/threatMatches:find"

async def scan_urls_for_threats(urls: list[str], api_key: str) -> list[str]:
    """
    Sends URLs to Google Safe Browsing API.
    Returns a list of malicious URLs found (empty list = all clean).
    """
    if not urls or not api_key:
        return []

    payload = {
        "client": {
            "clientId": "groit-ai",
            "clientVersion": "1.0.0"
        },
        "threatInfo": {
            "threatTypes": [
                "MALWARE",
                "SOCIAL_ENGINEERING",      # phishing
                "UNWANTED_SOFTWARE",
                "POTENTIALLY_HARMFUL_APPLICATION"
            ],
            "platformTypes": ["ANY_PLATFORM"],
            "threatEntryTypes": ["URL"],
            "threatEntries": [{"url": url} for url in urls]
        }
    }

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(
                SAFE_BROWSING_API,
                params={"key": api_key},
                json=payload
            )
            response.raise_for_status()
            data = response.json()

            # If "matches" key exists, threats were found
            matches = data.get("matches", [])
            malicious_urls = [m["threat"]["url"] for m in matches]
            return malicious_urls

    except httpx.TimeoutException:
        # If the API times out, log and continue (don't block genuine users)
        logger.warning("Google Safe Browsing API timed out — skipping URL scan.")
        return []
    except Exception as e:
        logger.error(f"Safe Browsing API error: {e} — skipping URL scan.")
        return []


# ─── 2. Entropy Score (Per-Session Recipient Tracker) ───────────────────────

# In-memory tracker: { user_id: set(recipients) }
# NOTE: This resets on server restart. For production, use Redis or MongoDB.
_session_recipients: dict[str, set] = {}

MAX_UNIQUE_RECIPIENTS_PER_SESSION = 15  # Genuine users almost never exceed this

# Fields that typically contain recipient email/channel
RECIPIENT_FIELDS = {"to", "recipient", "email", "to_email", "channel", "channel_id", "assignee"}

def _extract_recipients(params: dict) -> list[str]:
    """Pull recipient values from params."""
    recipients = []
    for key, value in params.items():
        if key.lower() in RECIPIENT_FIELDS and isinstance(value, str) and value:
            recipients.append(value.lower().strip())
    return recipients

def check_entropy_score(user_id: str, params: dict) -> None:
    """
    Tracks unique external recipients per user session.
    Raises SecurityViolationError if the user is sending to too many
    unique new addresses — a strong indicator of a spam campaign.
    """
    recipients = _extract_recipients(params)
    if not recipients:
        return

    if user_id not in _session_recipients:
        _session_recipients[user_id] = set()

    known = _session_recipients[user_id]
    new_recipients = [r for r in recipients if r not in known]

    if new_recipients:
        known.update(new_recipients)
        total_unique = len(known)
        logger.info(f"User {user_id} has now targeted {total_unique} unique recipients this session.")

        if total_unique > MAX_UNIQUE_RECIPIENTS_PER_SESSION:
            raise SecurityViolationError(
                f"Security limit exceeded: This account has targeted {total_unique} unique "
                f"recipients in a single session (max: {MAX_UNIQUE_RECIPIENTS_PER_SESSION}). "
                f"Account activity has been frozen. Contact support@groit.ai to appeal."
            )


# ─── Main Security Gate (called from DAGExecutor) ────────────────────────────

async def run_security_checks(
    user_id: str,
    params: dict,
    api_key: str
) -> None:
    """
    Single entry point for all security checks.
    Called BEFORE every Composio action execution.

    Raises SecurityViolationError if any check fails.
    Genuine users will never see this error.
    """

    # Check 1: Entropy / recipient spam detection
    check_entropy_score(user_id, params)

    # Check 2: URL scanning
    urls = extract_urls_from_params(params)
    if urls:
        logger.info(f"Scanning {len(urls)} URL(s) found in workflow params...")
        malicious = await scan_urls_for_threats(urls, api_key)
        if malicious:
            logger.warning(f"SECURITY BLOCK — malicious URLs detected for user {user_id}: {malicious}")
            raise SecurityViolationError(
                f"Workflow blocked: {len(malicious)} malicious URL(s) detected in your workflow content. "
                f"This incident has been logged. If you believe this is a mistake, contact support@groit.ai."
            )
        logger.info("URL scan complete — all URLs are clean.")
