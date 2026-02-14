"""Pydantic schemas for user accounts and authentication."""

from pydantic import BaseModel, EmailStr, field_validator
from core.security.auth import validate_password_strength


class UserBase(BaseModel):
    email: EmailStr


class UserCreate(UserBase):
    password: str

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not validate_password_strength(v):
            raise ValueError(
                "Password must contain at least 8 characters, 1 uppercase, 1 lowercase letter and 1 number"
            )
        return v


class User(UserBase):
    id: int
    is_active: bool

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
