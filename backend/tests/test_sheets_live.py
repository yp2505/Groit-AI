import asyncio
import os
import json
from dotenv import load_dotenv
from services.integrations.sheets_integration import execute_sheets

# Load environment variables
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "../.env"))

async def run_tests():
    print("--- Starting Google Sheets Live Integration Tests ---")
    
    # Check env
    creds = os.getenv("GOOGLE_SHEETS_CREDENTIALS_JSON")
    sheet_id = os.getenv("GOOGLE_SHEETS_ID")
    print(f"Credentials: {creds}")
    print(f"Sheet ID: {sheet_id}")
    
    # 1. Test Append Row
    print("\n[1] Testing append_row...")
    test_data = {
        "jira_issue": "TEST-100",
        "summary": "Integration test",
        "github_branch": "test/sheets-integration",
        "status": "Pending",
        "reported_at": "2026-04-11T12:00:00"
    }
    append_res = await execute_sheets("append_row", {"row_data": test_data, "sheet_name": "Sheet1"})
    print(f"Result: {json.dumps(append_res, indent=2)}")

    if append_res["status"] == "success":
        # 2. Test Read Row
        print("\n[2] Testing read_row...")
        read_res = await execute_sheets("read_row", {"row_key": "TEST-100", "sheet_name": "Sheet1"})
        print(f"Result: {json.dumps(read_res, indent=2)}")

        # 3. Test Update Row
        print("\n[3] Testing update_row...")
        update_res = await execute_sheets("update_row", {"row_key": "TEST-100", "status": "Success", "sheet_name": "Sheet1"})
        print(f"Result: {json.dumps(update_res, indent=2)}")
    else:
        print("\nSkipping read/update tests due to append failure.")
        print("Note: Ensure service account has access to the sheet and .env is correct.")

if __name__ == "__main__":
    asyncio.run(run_tests())
