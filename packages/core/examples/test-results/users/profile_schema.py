from pydantic import BaseModel, constr
from typing import Optional

class ProfileSchema(BaseModel):
    class Address(BaseModel):
        line1: str
        line2: Optional[str] = None
        city: str
        state: str
        postalCode: str
        country: str
    class Social(BaseModel):
        twitter: Optional[str] = None
        github: Optional[str] = None
        linkedin: Optional[str] = None
    bio: Optional[constr(max_length=240)] = None
    address: Optional[Address] = None
    social: Optional[Social] = None