import smtplib
import imaplib
import email
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging
import asyncio
from typing import Any, Dict, Optional

logger = logging.getLogger("mcp_gateway.gmail_integration")

def _send_email_sync(sender_email: str, app_password: str, to: str, subject: str, body: str) -> dict:
    """Send an email using SMTP over SSL (port 465)."""
    try:
        msg = MIMEMultipart()
        msg['From'] = sender_email
        msg['To'] = to
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'plain'))
        
        # Connect to Gmail SMTP server
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(sender_email, app_password)
            server.sendmail(sender_email, to, msg.as_string())
            
        return {
            "status": "success",
            "message": f"Email successfully sent to {to}"
        }
    except Exception as e:
        logger.error(f"Gmail SMTP error sending email: {e}")
        return {
            "status": "error",
            "error": f"Gmail SMTP failed: {str(e)}"
        }

def _list_emails_sync(sender_email: str, app_password: str, max_results: int = 5) -> dict:
    """Fetch recent email subjects/senders from inbox using IMAP over SSL (port 993)."""
    try:
        mail = imaplib.IMAP4_SSL('imap.gmail.com', 993)
        mail.login(sender_email, app_password)
        mail.select('inbox')
        
        # Search for all emails
        status, data = mail.search(None, 'ALL')
        if status != 'OK':
            raise Exception("Failed to search emails in inbox")
            
        mail_ids = data[0].split()
        latest_ids = mail_ids[-max_results:]
        emails = []
        
        # Process IDs in reverse (latest first)
        for mid in reversed(latest_ids):
            status, msg_data = mail.fetch(mid, '(RFC822)')
            if status != 'OK':
                continue
                
            raw_email = msg_data[0][1]
            msg = email.message_from_bytes(raw_email)
            
            # Extract subject and sender
            subject = msg.get('Subject', '(No Subject)')
            # Subject could be encoded, let's decode safely if possible
            decoded_subject = str(email.header.make_header(email.header.decode_header(subject)))
            
            sender = msg.get('From', '(Unknown Sender)')
            decoded_sender = str(email.header.make_header(email.header.decode_header(sender)))
            
            date = msg.get('Date', '')
            
            emails.append({
                "id": mid.decode('utf-8'),
                "subject": decoded_subject,
                "sender": decoded_sender,
                "date": date
            })
            
        mail.close()
        mail.logout()
        return {
            "status": "success",
            "emails": emails,
            "count": len(emails)
        }
    except Exception as e:
        logger.error(f"Gmail IMAP error fetching emails: {e}")
        return {
            "status": "error",
            "error": f"Gmail IMAP failed: {str(e)}"
        }

async def execute_gmail(action: str, params: Dict[str, Any], context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Main entry point for Gmail operations."""
    # Retrieve credentials from context (dynamic) or environment
    ctx_creds = (context or {}).get("credentials", {}).get("gmail", {})
    email_addr = ctx_creds.get("email") or params.get("sender_email")
    app_pwd = ctx_creds.get("password") or ctx_creds.get("token") or params.get("app_password")
    
    if not email_addr or not app_pwd:
        raise ValueError("Gmail Credentials Missing: Please connect your Gmail account in the Connect Tools page.")
        
    action = action.lower()
    
    if action in ("send_email", "send_mail"):
        to = params.get("to") or params.get("recipient")
        subject = params.get("subject", "Automated Alert")
        body = params.get("body") or params.get("content") or params.get("message", "")
        
        if not to:
            raise ValueError("Recipient 'to' email address is required for send_email.")
            
        logger.info(f"Gmail: Sending email to {to}")
        result = await asyncio.to_thread(_send_email_sync, email_addr, app_pwd, to, subject, body)
        return result
        
    elif action in ("list_emails", "list_messages", "get_emails"):
        max_results = int(params.get("max_results") or params.get("limit") or 5)
        logger.info(f"Gmail: Listing latest {max_results} emails")
        result = await asyncio.to_thread(_list_emails_sync, email_addr, app_pwd, max_results)
        return result
        
    else:
        raise ValueError(f"Unknown action: '{action}' for Gmail tool.")
