import smtplib
from email.message import EmailMessage

from app.config import settings


def send_email(to: str, subject: str, body: str) -> None:
    if not settings.smtp_host:
        print(f"\n===== DEV EMAIL =====\nTo: {to}\nSubject: {subject}\n{body}\n=====================\n", flush=True)
        return
    msg = EmailMessage()
    msg["From"] = settings.smtp_from or settings.smtp_user
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
        server.starttls()
        server.login(settings.smtp_user, settings.smtp_password)
        server.send_message(msg)