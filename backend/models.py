from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)
    hashed_password: str

class Message(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    sender_id: int = Field(foreign_key="user.id")
    receiver_id: int = Field(foreign_key="user.id")
    sender_username: str = Field(index=True)  # Keep for backward compatibility
    receiver_username: str = Field(index=True)  # Keep for backward compatibility
    ciphertext: str
    iv: str
    timestamp: datetime = Field(default_factory=datetime.utcnow, index=True)