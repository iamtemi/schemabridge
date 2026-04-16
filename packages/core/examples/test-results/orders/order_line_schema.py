from pydantic import BaseModel, confloat, conint
from enum import Enum

class CurrencyEnum(str, Enum):
    USD = "USD"
    EUR = "EUR"
    GBP = "GBP"
    JPY = "JPY"

class OrderLineSchema(BaseModel):
    sku: str
    quantity: conint(gt=0)
    unitPrice: confloat(gt=0)
    currency: CurrencyEnum