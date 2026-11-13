from pydantic import BaseModel, EmailStr, Field, field_validator, ConfigDict
from typing import Optional
from datetime import datetime
from app.core.security import validate_password_strength

class UserRegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8)
    confirm_password: str
    terms_accepted: bool = Field(..., description="Must accept terms and privacy policy")

    @field_validator("password")
    @classmethod
    def validate_password_complexity(cls, v):
        is_valid, err_msg = validate_password_strength(v)
        if not is_valid:
            raise ValueError(err_msg)
        return v

    @field_validator("confirm_password")
    @classmethod
    def passwords_match(cls, v, values):
        if "password" in values.data and v != values.data["password"]:
            raise ValueError("Passwords do not match.")
        return v

    @field_validator("terms_accepted")
    @classmethod
    def terms_must_be_accepted(cls, v):
        if not v:
            raise ValueError("You must accept the Terms of Service and Privacy Policy.")
        return v

class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str
    remember_me: bool = False

class VerifyEmailRequest(BaseModel):
    token: str = Field(..., min_length=10)

class ResendVerificationRequest(BaseModel):
    email: EmailStr

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=10)
    new_password: str = Field(..., min_length=8)
    confirm_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password_complexity(cls, v):
        is_valid, err_msg = validate_password_strength(v)
        if not is_valid:
            raise ValueError(err_msg)
        return v

    @field_validator("confirm_password")
    @classmethod
    def passwords_match(cls, v, values):
        if "new_password" in values.data and v != values.data["new_password"]:
            raise ValueError("Passwords do not match.")
        return v

class UserResponse(BaseModel):
    id: int
    full_name: str
    email: str
    is_email_verified: bool
    google_id: Optional[str] = None
    auth_provider: str = "email"
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class AuthStatusResponse(BaseModel):
    success: bool
    message: str
    user: Optional[UserResponse] = None
    email_delivered: Optional[bool] = None
    delivery_notice: Optional[str] = None

class SessionStatusResponse(BaseModel):
    authenticated: bool
    user: Optional[UserResponse] = None
