from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    jwt_secret: str
    jwt_ttl_minutes: int = 60
    allowed_email_domain: str = "sggs.ac.in"
    frontend_base_url: str = "http://localhost:5500"
    verification_ttl_minutes: int = 30

    # SMTP khali chhodo to mail console me print hogi (dev mode)
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""

    @field_validator("jwt_secret")
    @classmethod
    def secret_long_enough(cls, v: str) -> str:
        if len(v) < 32:
            raise ValueError("JWT_SECRET must be at least 32 characters")
        return v


settings = Settings()