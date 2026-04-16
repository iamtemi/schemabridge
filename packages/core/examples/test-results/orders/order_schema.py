from pydantic import BaseModel, Field, confloat, conint, constr
from typing import List, Optional
from enum import Enum
from datetime import date
from uuid import UUID

class UserStatusEnum(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"

class UserRolesItemEnum(str, Enum):
    ADMIN = "admin"
    ANALYST = "analyst"
    OPS = "ops"
    VIEWER = "viewer"

class LinesItemCurrencyEnum(str, Enum):
    USD = "USD"
    EUR = "EUR"
    GBP = "GBP"
    JPY = "JPY"

class RelatedProductsItemDimensionsUnitEnum(str, Enum):
    CM = "cm"
    IN = "in"

class OrderSchema(BaseModel):
    class User(BaseModel):
        class UserProfile(BaseModel):
            class UserProfileAddress(BaseModel):
                line1: str
                line2: Optional[str] = None
                city: str
                state: str
                postalCode: str
                country: str
            class UserProfileSocial(BaseModel):
                twitter: Optional[str] = None
                github: Optional[str] = None
                linkedin: Optional[str] = None
            bio: Optional[constr(max_length=240)] = None
            address: Optional[UserProfileAddress] = None
            social: Optional[UserProfileSocial] = None
        id: UUID
        email: str
        status: UserStatusEnum
        roles: List[UserRolesItemEnum]
        createdAt: date
        profile: Optional[UserProfile] = None
    class LinesItem(BaseModel):
        sku: str
        quantity: conint(gt=0)
        unitPrice: confloat(gt=0)
        currency: LinesItemCurrencyEnum
    class RelatedProductsItem(BaseModel):
        class RelatedProductsItemDimensions(BaseModel):
            length: confloat(gt=0)
            width: confloat(gt=0)
            height: confloat(gt=0)
            unit: RelatedProductsItemDimensionsUnitEnum
        sku: constr(min_length=3)
        name: constr(min_length=1, max_length=120)
        status: UserStatusEnum
        price: confloat(gt=0)
        currency: LinesItemCurrencyEnum
        tags: List[str] = Field(default_factory=list)
        dimensions: Optional[RelatedProductsItemDimensions] = None
    id: UUID
    user: User
    lines: List[LinesItem]
    total: confloat(gt=0)
    currency: LinesItemCurrencyEnum
    placedAt: date
    notes: Optional[str] = None
    relatedProducts: Optional[List[RelatedProductsItem]] = None