from pydantic import BaseModel, constr
from typing import List, Optional
from enum import Enum
from datetime import date
from uuid import UUID

class StatusEnum(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"

class RolesItemEnum(str, Enum):
    ADMIN = "admin"
    ANALYST = "analyst"
    OPS = "ops"
    VIEWER = "viewer"

class UserSchema(BaseModel):
    class Profile(BaseModel):
        class ProfileAddress(BaseModel):
            line1: str
            line2: Optional[str] = None
            city: str
            state: str
            postalCode: str
            country: str
        class ProfileSocial(BaseModel):
            twitter: Optional[str] = None
            github: Optional[str] = None
            linkedin: Optional[str] = None
        bio: Optional[constr(max_length=240)] = None
        address: Optional[ProfileAddress] = None
        social: Optional[ProfileSocial] = None
    id: UUID
    email: str
    status: StatusEnum
    roles: List[RolesItemEnum]
    createdAt: date
    profile: Optional[Profile] = None