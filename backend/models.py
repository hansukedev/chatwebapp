from sqlmodel import SQLModel, Field
from typing import Optional, List
from datetime import datetime

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)
    hashed_password: str
    is_online: bool = Field(default=False)

class Room(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    created_by: int = Field(foreign_key="user.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = Field(default=True)

class RoomMember(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    room_id: int = Field(foreign_key="room.id")
    user_id: int = Field(foreign_key="user.id")
    joined_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = Field(default=True)

class Message(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    sender_id: int = Field(foreign_key="user.id")
    receiver_id: Optional[int] = Field(default=None, foreign_key="user.id")  # For private messages
    room_id: Optional[int] = Field(default=None, foreign_key="room.id")     # For group messages
    sender_username: str = Field(index=True)
    receiver_username: Optional[str] = Field(default=None, index=True)
    room_name: Optional[str] = Field(default=None, index=True)
    message_type: str = Field(default="private")  # "private" or "group"
    ciphertext: str
    iv: str
    timestamp: datetime = Field(default_factory=datetime.utcnow, index=True)