from enum import Enum

class RoleEnum(str, Enum):
    ADMIN = "admin"
    ANALYST = "analyst"
    OPS = "ops"
    VIEWER = "viewer"