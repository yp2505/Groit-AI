# pyrefly: ignore [missing-import]
from googleapiclient.discovery import build
# pyrefly: ignore [missing-import]
from google.oauth2.service_account import Credentials
import os
import asyncio
import logging
from typing import Any, Dict, Optional

logger = logging.getLogger("mcp_gateway.gcalendar_integration")

def normalize_iso_datetime(dt_str: str) -> str:
    """Normalize relative strings like 'tomorrowT15:00:00' to standard ISO 8601."""
    import datetime
    dt_str = str(dt_str).strip()
    
    # Check if already a valid ISO string
    try:
        datetime.datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
        return dt_str
    except ValueError:
        pass

    # Resolve today/tomorrow
    now = datetime.datetime.utcnow()
    date_part = now.date()
    time_part = "12:00:00"

    dt_lower = dt_str.lower()
    if "tomorrow" in dt_lower:
        date_part = (now + datetime.timedelta(days=1)).date()
        time_str = dt_lower.replace("tomorrow", "").strip("t").strip()
        if time_str:
            time_part = time_str
    elif "today" in dt_lower:
        date_part = now.date()
        time_str = dt_lower.replace("today", "").strip("t").strip()
        if time_str:
            time_part = time_str

    # Clean time string format HH:MM:SS
    if len(time_part.split(':')) == 2:
        time_part += ":00"

    return f"{date_part}T{time_part}"

def get_calendar_service(context: Optional[Dict] = None):
    """Retrieve an authenticated Google Calendar API client."""
    # Priority 1: User OAuth Token (from context)
    gcal_creds = (context or {}).get("credentials", {}).get("gcalendar", {})
    google_creds = (context or {}).get("credentials", {}).get("google", {})
    
    oauth_token = gcal_creds.get("access_token") or gcal_creds.get("token")
    if not oauth_token or oauth_token == "env-configured":
        oauth_token = google_creds.get("access_token") or google_creds.get("token") or oauth_token
    
    scopes = ['https://www.googleapis.com/auth/calendar']
    
    if oauth_token and oauth_token != "env-configured":
        try:
            from google.oauth2.credentials import Credentials as OAuthCredentials
            creds = OAuthCredentials(token=oauth_token)
            logger.info("Calendar API: Attempting to use user OAuth token")
            return build('calendar', 'v3', credentials=creds)
        except Exception as e:
            logger.warning(f"Calendar API: User OAuth token invalid ({e}). Falling back to service account.")
            
    # Priority 2: Service Account (from env or fallback)
    creds_env = os.getenv("GOOGLE_SHEETS_CREDENTIALS_JSON") # Reuse Sheets env credential string if set
    
    if creds_env and creds_env.strip().startswith("{"):
        import json
        try:
            creds_info = json.loads(creds_env)
            creds = Credentials.from_service_account_info(creds_info, scopes=scopes)
            logger.info("Calendar API: Using service account from env JSON string")
            return build('calendar', 'v3', credentials=creds)
        except Exception as e:
            raise ValueError(f"Invalid Google Calendar credentials JSON string: {e}")
            
    creds_path = creds_env
    if not creds_path:
        creds_path = os.path.join(os.getcwd(), "credentials", "service_account.json")
        
    if not os.path.exists(creds_path):
        raise FileNotFoundError(f"Google Calendar credentials not found at: {creds_path}. Place your service_account.json in the credentials/ folder.")
        
    creds = Credentials.from_service_account_file(creds_path, scopes=scopes)
    logger.info(f"Calendar API: Using service account credentials file: {creds_path}")
    return build('calendar', 'v3', credentials=creds)

def _create_event_sync(service, calendar_id: str, summary: str, start_time: str, end_time: str, description: Optional[str] = None) -> dict:
    """Synchronously create an event on Google Calendar."""
    try:
        event = {
            'summary': summary,
            'description': description or '',
            'start': {
                'dateTime': start_time,
                'timeZone': 'UTC',
            },
            'end': {
                'dateTime': end_time,
                'timeZone': 'UTC',
            },
        }
        
        created_event = service.events().insert(calendarId=calendar_id, body=event).execute()
        html_link = created_event.get("htmlLink")
        
        actual_calendar_id = calendar_id
        if calendar_id == "primary":
            try:
                primary_cal = service.calendars().get(calendarId='primary').execute()
                actual_calendar_id = primary_cal.get('id', calendar_id)
            except Exception:
                pass

        if html_link and actual_calendar_id and "@" in actual_calendar_id:
            if "?" in html_link:
                html_link += f"&authuser={actual_calendar_id}"
            else:
                html_link += f"?authuser={actual_calendar_id}"

        return {
            "status": "success",
            "output": {
                "event_id": created_event.get("id"),
                "summary": created_event.get("summary"),
                "start": created_event.get("start", {}).get("dateTime"),
                "end": created_event.get("end", {}).get("dateTime"),
                "html_link": html_link
            }
        }
    except Exception as e:
        logger.error(f"Google Calendar error creating event: {e}")
        return {"status": "error", "error": str(e)}

def _list_events_sync(service, calendar_id: str, max_results: int = 10) -> dict:
    """Synchronously list upcoming events on Google Calendar."""
    try:
        import datetime
        now = datetime.datetime.utcnow().isoformat() + 'Z' # 'Z' indicates UTC time
        
        events_result = service.events().list(
            calendarId=calendar_id, timeMin=now,
            maxResults=max_results, singleEvents=True,
            orderBy='startTime'
        ).execute()
        
        events = events_result.get('items', [])
        formatted_events = []
        for event in events:
            formatted_events.append({
                "id": event.get("id"),
                "summary": event.get("summary", "(No Title)"),
                "start": event.get("start", {}).get("dateTime") or event.get("start", {}).get("date"),
                "end": event.get("end", {}).get("dateTime") or event.get("end", {}).get("date"),
                "html_link": event.get("htmlLink")
            })
            
        return {
            "status": "success",
            "output": {
                "events": formatted_events,
                "count": len(formatted_events)
            }
        }
    except Exception as e:
        logger.error(f"Google Calendar error listing events: {e}")
        return {"status": "error", "error": str(e)}

async def execute_gcalendar(action: str, params: Dict[str, Any], context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Main entry point for Google Calendar operations."""
    try:
        # Build client (runs in thread pool to avoid blocking async loop)
        service = await asyncio.to_thread(get_calendar_service, context)
        
        ctx_creds = (context or {}).get("credentials", {}).get("gcalendar", {})
        calendar_id = params.get("calendar_id") or ctx_creds.get("calendar_id") or "primary"
        if calendar_id == "{{calendar_id}}":
            calendar_id = "primary"

        # Resolve primary calendar ID to user email/shared calendar for service account execution
        gcal_creds = (context or {}).get("credentials", {}).get("gcalendar", {})
        google_creds = (context or {}).get("credentials", {}).get("google", {})
        
        oauth_token = gcal_creds.get("access_token") or gcal_creds.get("token")
        if not oauth_token or oauth_token == "env-configured":
            oauth_token = google_creds.get("access_token") or google_creds.get("token") or oauth_token

        is_service_account = not oauth_token or oauth_token == "env-configured"
        
        if is_service_account and calendar_id == "primary":
            logger.info("Calendar API: Forcing calendar_id to khushdesai2006@gmail.com")
            calendar_id = "khushdesai2006@gmail.com"
            
        action = action.lower()
        logger.info(f"Debug context: {context}")

        async def _run_action(srv):
            if action in ("create_event", "add_event", "schedule_event", "schedule_meeting"):
                summary = params.get("summary") or params.get("title") or "Scheduled Event"
                start_time = params.get("start_time") or params.get("start")
                end_time = params.get("end_time") or params.get("end")
                description = params.get("description") or params.get("content") or ""
                
                if not start_time or not end_time:
                    raise ValueError("Both 'start_time' and 'end_time' (in ISO format) are required to create a calendar event.")
                
                # Normalize relative date-time strings
                start_time = normalize_iso_datetime(start_time)
                end_time = normalize_iso_datetime(end_time)
                    
                logger.info(f"Calendar API: Creating event '{summary}' on '{calendar_id}'")
                result = await asyncio.to_thread(
                    _create_event_sync, srv, calendar_id, summary, start_time, end_time, description
                )
                return result
                
            elif action in ("list_events", "get_events", "list_schedule"):
                max_results = int(params.get("max_results") or params.get("limit") or 10)
                logger.info(f"Calendar API: Listing upcoming {max_results} events on '{calendar_id}'")
                result = await asyncio.to_thread(_list_events_sync, srv, calendar_id, max_results)
                return result
                
            else:
                raise ValueError(f"Unknown action: '{action}' for Google Calendar tool.")

        res = await _run_action(service)
        
        # If execution fails because of OAuth credentials/refresh token issues, retry with service account fallback
        if res.get("status") == "error":
            err_str = str(res.get("error"))
            if any(k in err_str.lower() for k in ("refresh", "token", "invalid_grant", "expired", "credentials")):
                logger.warning(f"Calendar API: Execution failed due to credentials ({err_str}). Retrying with service account fallback.")
                service_fallback = await asyncio.to_thread(get_calendar_service, None)
                
                # Resolve primary calendar ID to user email/shared calendar for service account fallback
                if calendar_id == "primary" or calendar_id == "khushdesai2006@gmail.com":
                    try:
                        calendar_list = service_fallback.calendarList().list().execute()
                        items = calendar_list.get('items', [])
                        for item in items:
                            c_id = item.get('id', '')
                            if c_id and not c_id.endswith("gserviceaccount.com"):
                                logger.info(f"Calendar API: Auto-detected shared calendar ID: '{c_id}' (fallback)")
                                calendar_id = c_id
                                break
                    except Exception as e:
                        logger.warning(f"Calendar API: Failed to auto-detect shared calendar: {e}")
                
                res = await _run_action(service_fallback)

        return res
            
    except Exception as e:
        return {"status": "error", "error": str(e)}
