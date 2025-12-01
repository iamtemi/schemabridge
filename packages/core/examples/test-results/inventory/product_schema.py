from pydantic import BaseModel, Field, confloat, constr
from typing import List, Optional
from enum import Enum

class DimensionsUnitEnum(str, Enum):
    CM = "cm"
    IN = "in"

class StatusEnum(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"

class CurrencyEnum(str, Enum):
    USD = "USD"
    EUR = "EUR"
    GBP = "GBP"
    JPY = "JPY"

class ProductSchema(BaseModel):
    class Dimensions(BaseModel):
        length: confloat(gt=0)
        width: confloat(gt=0)
        height: confloat(gt=0)
        unit: DimensionsUnitEnum
    sku: constr(min_length=3)
    name: constr(min_length=1, max_length=120)
    status: StatusEnum
    price: confloat(gt=0)
    currency: CurrencyEnum
    tags: List[str] = Field(default_factory=list)
    dimensions: Optional[Dimensions] = None