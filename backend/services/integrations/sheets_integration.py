import gspread
from google.oauth2.service_account import Credentials
import os
import asyncio
import logging
from typing import Any, Dict, Optional
from dotenv import load_dotenv
load_dotenv()
logger = logging.getLogger("mcp_gateway.sheets_integration")

def get_sheets_client(context: Optional[Dict] = None):
    # Priority 1: User OAuth Token (from context)
    ctx_creds = (context or {}).get("credentials", {}).get("sheets", {}) or (context or {}).get("credentials", {}).get("google", {})
    oauth_token = ctx_creds.get("access_token") or ctx_creds.get("token")
    
    if oauth_token:
        try:
            from google.oauth2.credentials import Credentials as OAuthCredentials
            creds = OAuthCredentials(token=oauth_token)
            
            # Fast check: if we have a way to check validity without a network hit, do it
            # Otherwise, allow gspread to try; if it fails later, we catch it in execute_sheets
            logger.info("Sheets API: Attempting to use user OAuth token")
            return gspread.authorize(creds)
        except Exception as e:
            logger.warning(f"Sheets API: User OAuth token invalid or expired ({e}). Falling back to service account.")
            # Fall through to service account logic

    # Priority 2: Service Account (from context or env)
    creds_env = ctx_creds.get("GOOGLE_SHEETS_CREDENTIALS_JSON") or os.getenv("GOOGLE_SHEETS_CREDENTIALS_JSON")
    
    scopes = [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive'
    ]

    # Check if creds is a raw JSON string
    if creds_env and creds_env.strip().startswith("{"):
        import json
        try:
            creds_info = json.loads(creds_env)
            creds = Credentials.from_service_account_info(creds_info, scopes=scopes)
            logger.info("Sheets API: Using service account credentials from raw JSON string")
            return gspread.authorize(creds)
        except Exception as e:
            raise ValueError(f"Invalid Google Sheets credentials JSON string: {e}")
    
    creds_path = creds_env
    if not creds_path:
        creds_path = os.path.join(os.getcwd(), "credentials", "service_account.json")
    
    if not os.path.exists(creds_path):
        raise FileNotFoundError(f"Google Sheets credentials not found at: {creds_path}. Place your service_account.json in the credentials/ folder.")
    
    creds = Credentials.from_service_account_file(creds_path, scopes=scopes)
    logger.info(f"Sheets API: Using service account credentials file: {creds_path}")
    return gspread.authorize(creds)

def _read_row_sync(worksheet: gspread.Worksheet, row_key: str) -> Dict[str, Any]:
    try:
        cell = worksheet.find(row_key, in_column=1)
        if cell:
            row_data = worksheet.row_values(cell.row)
            return {
                "status": "success",
                "output": {"row": cell.row, "values": row_data}
            }
        return {"status": "error", "error": f"Row key '{row_key}' not found"}
    except Exception as e:
        return {"status": "error", "error": str(e)}

def _update_row_sync(worksheet: gspread.Worksheet, row_key: str, status: str) -> Dict[str, Any]:
    try:
        cell = worksheet.find(row_key, in_column=1)
        if cell:
            headers = [h.lower() for h in worksheet.row_values(1)]
            try:
                status_col = headers.index("status") + 1
            except ValueError:
                return {"status": "error", "error": "Column 'status' not found in headers"}
            
            worksheet.update_cell(cell.row, status_col, status)
            return {
                "status": "success",
                "output": {"row": cell.row, "updated_to": status}
            }
        return {"status": "error", "error": f"Row key '{row_key}' not found"}
    except Exception as e:
        return {"status": "error", "error": str(e)}

def _append_row_sync(worksheet: gspread.Worksheet, row_data: Any) -> Dict[str, Any]:
    try:
        if isinstance(row_data, str):
            row_data = [row_data]
            
        if isinstance(row_data, list):
            # If the user passed a list, just append it directly
            new_row = [str(item) for item in row_data]
            worksheet.append_row(new_row)
            return {
                "status": "success",
                "output": {"row_data": new_row}
            }

        headers = worksheet.row_values(1)
        new_row = []
        for h in headers:
            key = h.lower().replace(" ", "_")
            # Try different key mappings
            val = row_data.get(key)
            if val is None:
                val = row_data.get(h)
            
            new_row.append(str(val) if val is not None else "")
        
        # If headers are empty or we failed to map ANY keys to the headers, just append raw values
        is_empty_row = all(val == "" for val in new_row)
        if (not headers or is_empty_row) and row_data:
            new_row = [str(v) for v in row_data.values()]

        worksheet.append_row(new_row)
        return {
            "status": "success",
            "output": {"row_data": new_row}
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}

async def execute_sheets(action: str, params: Dict[str, Any], context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Main entry point for Google Sheets operations.
    Bridges the async executor with synchronous gspread calls.
    """
    try:
        action = action.lower().strip()
        # Attempt initialization (might use user token from context)
        client = await asyncio.to_thread(get_sheets_client, context)
        ctx_creds = (context or {}).get("credentials", {}).get("sheets", {}) or (context or {}).get("credentials", {}).get("google", {})
        sheet_id = ctx_creds.get("GOOGLE_SHEETS_ID") or os.getenv("GOOGLE_SHEETS_ID")
        
        if not sheet_id:
            raise ValueError("Spreadsheet ID Missing: Please provide a Spreadsheet ID in the 'Connect Tools' dashboard.")
            
        try:
            spreadsheet = await asyncio.to_thread(client.open_by_key, sheet_id)
        except Exception as auth_err:
            # If the user token is specifically what failed (e.g. RefreshError), retry with Service Account
            if "refresh_token" in str(auth_err).lower() or "invalid_grant" in str(auth_err).lower() or "expired" in str(auth_err).lower():
                logger.warning(f"Sheets API: User token failed during open_by_key ({auth_err}). Forcing Service Account fallback.")
                client = await asyncio.to_thread(get_sheets_client, None) # Force service account by passing context=None
                spreadsheet = await asyncio.to_thread(client.open_by_key, sheet_id)
            else:
                raise auth_err

        sheet_name = params.get("sheet_name", "Sheet1")
        if sheet_name and sheet_name.startswith("{{"):
            sheet_name = "Sheet1"
            
        try:
            worksheet = await asyncio.to_thread(spreadsheet.worksheet, sheet_name)
        except gspread.exceptions.WorksheetNotFound:
            logger.warning(f"Worksheet '{sheet_name}' not found. Falling back to 'Sheet1' or creating it.")
            try:
                worksheet = await asyncio.to_thread(spreadsheet.worksheet, "Sheet1")
            except gspread.exceptions.WorksheetNotFound:
                # If even Sheet1 doesn't exist, create the requested sheet
                try:
                    worksheet = await asyncio.to_thread(spreadsheet.add_worksheet, title=sheet_name, rows=100, cols=20)
                except Exception as e:
                    return {"status": "error", "error": f"Could not find or create sheet '{sheet_name}'. Google API error: {str(e)}"}
        result = None
        if action == "read_row":
            row_key = params.get("row_key")
            result = await asyncio.to_thread(_read_row_sync, worksheet, row_key)
        
        elif action == "update_row":
            row_key = params.get("row_key")
            status = params.get("status")
            result = await asyncio.to_thread(_update_row_sync, worksheet, row_key, status)
            
        elif action == "append_row":
            row_data = params.get("row_data", {})
            if not row_data and params:
                 # If row_data is empty but params has values, use params as row_data
                 row_data = {k: v for k, v in params.items() if k not in ("sheet_name", "action")}
            
            # Add identifiable test data (timestamp)
            from datetime import datetime
            if isinstance(row_data, dict):
                if "timestamp" not in row_data:
                    row_data["timestamp"] = datetime.now().isoformat()
            
            logger.info(f"Appending row to {sheet_name}: {row_data}")
            result = await asyncio.to_thread(_append_row_sync, worksheet, row_data)
            
        elif action == "create_sheet":
            # Create a new worksheet (or find existing one) in the spreadsheet
            try:
                ws = await asyncio.to_thread(spreadsheet.worksheet, sheet_name)
                logger.info(f"Sheet '{sheet_name}' already exists, reusing it")
                result = {
                    "status": "success",
                    "output": {"sheet_name": sheet_name, "message": f"Sheet '{sheet_name}' already exists"}
                }
            except gspread.exceptions.WorksheetNotFound:
                ws = await asyncio.to_thread(spreadsheet.add_worksheet, title=sheet_name, rows=100, cols=20)
                logger.info(f"Created new sheet: {sheet_name}")
                result = {
                    "status": "success",
                    "output": {"sheet_name": sheet_name, "message": f"Sheet '{sheet_name}' created successfully"}
                }
        
        elif action == "populate_sheet":
            # Populate existing sheet with data — supports dummy_data flag or row_data
            row_data = params.get("row_data", {})
            dummy_data = params.get("dummy_data", False)
            
            if dummy_data and not row_data:
                # Generate sample data
                from datetime import datetime
                sample_rows = [
                    ["Name", "Email", "Role", "Status", "Created"],
                    ["John Doe", "john@example.com", "Developer", "Active", datetime.now().isoformat()],
                    ["Jane Smith", "jane@example.com", "Designer", "Active", datetime.now().isoformat()],
                    ["Bob Wilson", "bob@example.com", "PM", "Inactive", datetime.now().isoformat()],
                ]
                for row in sample_rows:
                    await asyncio.to_thread(worksheet.append_row, row)
                result = {
                    "status": "success",
                    "output": {"rows_added": len(sample_rows), "sheet_name": sheet_name, "message": "Dummy data populated"}
                }
            elif row_data:
                if isinstance(row_data, list):
                    for row in row_data:
                        if isinstance(row, list):
                            await asyncio.to_thread(worksheet.append_row, [str(v) for v in row])
                        elif isinstance(row, dict):
                            await asyncio.to_thread(worksheet.append_row, [str(v) for v in row.values()])
                    result = {
                        "status": "success",
                        "output": {"rows_added": len(row_data), "sheet_name": sheet_name}
                    }
                else:
                    result = await asyncio.to_thread(_append_row_sync, worksheet, row_data)
            else:
                result = {
                    "status": "success",
                    "output": {"message": "No data to populate", "sheet_name": sheet_name}
                }

        else:
            # Fallback: treat any unknown sheets action as append_row
            logger.warning(f"Unknown sheets action '{action}' — falling back to append_row")
            row_data = params.get("row_data", {})
            if not row_data and params:
                row_data = {k: v for k, v in params.items() if k not in ("sheet_name", "action")}
            
            if row_data:
                from datetime import datetime
                if isinstance(row_data, dict) and "timestamp" not in row_data:
                    row_data["timestamp"] = datetime.now().isoformat()
                result = await asyncio.to_thread(_append_row_sync, worksheet, row_data)
            else:
                # If no data at all, just confirm the sheet exists
                result = {
                    "status": "success",
                    "output": {"message": f"Sheet '{sheet_name}' is accessible. Action '{action}' completed.", "sheet_name": sheet_name}
                }

        # Add common fields to result
        result["tool"] = "sheets"
        result["action"] = action
        return result

    except Exception as e:
        error_msg = str(e)
        if not error_msg and getattr(e, "__cause__", None):
            error_msg = str(e.__cause__)
        if not error_msg:
            error_msg = repr(e)
        logger.error(f"Sheets execution failed: {error_msg}")
        return {
            "status": "error",
            "tool": "sheets",
            "action": action,
            "error": error_msg
        }
