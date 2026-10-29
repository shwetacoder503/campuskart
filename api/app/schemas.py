from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel


class RegisterRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    full_name: str = Field(alias="fullName", min_length=1, max_length=100)
    email: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=8, max_length=72)

    @field_validator("password")
    @classmethod
    def password_bytes_limit(cls, v: str) -> str:
        if len(v.encode("utf-8")) > 72:  # bcrypt 72 byte tak hi padhta hai
            raise ValueError("Password is too long")
        return v


class LoginRequest(BaseModel):
    email: str = Field(min_length=1)
    password: str = Field(min_length=1)


class VerifyEmailRequest(BaseModel):
    token: str = Field(min_length=1)


class ResendVerificationRequest(BaseModel):
    email: str = Field(min_length=1)


# ---------- Products ----------

Category = Literal["BOOKS", "CALCULATORS", "LAB_GEAR", "HOSTEL", "ELECTRONICS", "OTHER"]
Condition = Literal["NEW", "LIKE_NEW", "GOOD", "FAIR"]
ProductStatus = Literal["AVAILABLE", "RESERVED", "SOLD"]


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class ProductCreate(CamelModel):
    title: str = Field(min_length=3, max_length=150)
    description: str = Field(min_length=10, max_length=2000)
    category: Category
    price: Decimal = Field(gt=0, le=100000, max_digits=8, decimal_places=2)
    item_condition: Condition = "GOOD"

    @field_validator("title", "description")
    @classmethod
    def strip_text(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Must not be blank")
        return v


class ProductOut(CamelModel):
    id: int
    seller_id: int
    seller_name: str
    title: str
    description: str
    category: str
    price: Decimal
    item_condition: str
    status: str
    created_at: datetime
    updated_at: datetime
    images: list[str] = []


class ProductList(CamelModel):
    items: list[ProductOut]
    page: int
    size: int
    total: int