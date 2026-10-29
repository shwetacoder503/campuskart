import re
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.emailer import send_email
from app.models import EmailVerificationToken, User
from app.schemas import (LoginRequest, RegisterRequest,
                         ResendVerificationRequest, VerifyEmailRequest)
from app.security import (DUMMY_HASH, create_access_token, hash_password,
                          new_token, sha256_hex, utcnow, verify_password)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def validate_college_email(email: str) -> None:
    local, sep, domain = email.partition("@")
    ok = bool(sep) and "@" not in domain and domain == settings.allowed_email_domain \
        and re.fullmatch(r"[a-z0-9._-]+", local) is not None
    if not ok:
        raise HTTPException(400, f"Please use your college email (@{settings.allowed_email_domain})")


def send_verification(db: Session, user: User) -> None:
    now = utcnow()
    recent = db.scalar(
        select(EmailVerificationToken.id)
        .where(EmailVerificationToken.user_id == user.id,
               EmailVerificationToken.created_at > now - timedelta(seconds=60))
        .limit(1)
    )
    if recent:  # 60 second me ek hi mail
        return
    db.execute(delete(EmailVerificationToken).where(EmailVerificationToken.user_id == user.id))
    raw = new_token()
    db.add(EmailVerificationToken(
        user_id=user.id,
        token_hash=sha256_hex(raw),
        expires_at=now + timedelta(minutes=settings.verification_ttl_minutes),
        created_at=now,
    ))
    db.commit()

    link = f"{settings.frontend_base_url}/verify.html?token={raw}"
    body = (f"Hi {user.full_name},\n\nClick the link to verify your email:\n{link}\n\n"
            f"This link expires in {settings.verification_ttl_minutes} minutes.")
    try:
        send_email(user.email, "Verify your CampusKart email", body)
    except Exception as exc:  # mail fail ho to user resend kar sakta hai
        print(f"Failed to send email: {exc}", flush=True)


@router.post("/register", status_code=201)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    email = req.email.strip().lower()
    validate_college_email(email)

    user = db.scalar(select(User).where(User.email == email))
    if user is not None and user.email_verified:
        raise HTTPException(409, "This email is already registered")
    if user is None:
        user = User(email=email)
        db.add(user)
    # naya user, ya purana UNVERIFIED user (squatting fix): naam + password overwrite
    user.full_name = req.full_name.strip()
    user.password_hash = hash_password(req.password)
    db.commit()
    db.refresh(user)

    send_verification(db, user)
    return {"message": "Account created. Check your college email to verify."}


@router.post("/verify-email")
def verify_email(req: VerifyEmailRequest, db: Session = Depends(get_db)):
    invalid = HTTPException(400, "Invalid or expired verification link")
    t = db.scalar(select(EmailVerificationToken)
                  .where(EmailVerificationToken.token_hash == sha256_hex(req.token.strip())))
    if t is None or t.used_at is not None or t.expires_at < utcnow():
        raise invalid
    user = db.get(User, t.user_id)
    if user is None:
        raise invalid
    user.email_verified = True
    t.used_at = utcnow()
    db.commit()
    return {"message": "Email verified. You can now log in."}


@router.post("/resend-verification")
def resend_verification(req: ResendVerificationRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == req.email.strip().lower()))
    if user is not None and not user.email_verified:
        send_verification(db, user)
    # user mile ya na mile, response same (koi email guess na kar sake)
    return {"message": "If this account exists and is unverified, a new email has been sent."}


@router.post("/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    email = req.email.strip().lower()
    validate_college_email(email)
    user = db.scalar(select(User).where(User.email == email))

    # user na mile tab bhi hash compare hota hai, taaki response time se email guess na ho
    password_ok = verify_password(req.password, user.password_hash if user else DUMMY_HASH)
    if user is None or not password_ok:
        raise HTTPException(401, "Invalid email or password")
    if not user.email_verified:
        raise HTTPException(403, "Please verify your college email first")

    return {
        "token": create_access_token(user.id, user.role),
        "tokenType": "Bearer",
        "expiresInSeconds": settings.jwt_ttl_minutes * 60,
        "user": {"id": user.id, "fullName": user.full_name, "email": user.email, "role": user.role},
    }