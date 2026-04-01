"""Public marketing contact form."""

from pydantic import BaseModel, Field


class PublicContactIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    email: str = Field(..., min_length=3, max_length=320)
    company: str = Field(default="", max_length=200)
    message: str = Field(..., min_length=1, max_length=8000)
