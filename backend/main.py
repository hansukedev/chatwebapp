import json
from typing import List, Dict, Optional
from datetime import datetime

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select
from sqlalchemy import or_

from database import engine, create_db_and_tables
from models import User, Message, Room, RoomMember
from security import get_password_hash, verify_password, create_access_token, SECRET_KEY, ALGORITHM
from jose import JWTError, jwt
from fastapi.security import OAuth2PasswordBearer

# Pydantic models for request/response
from pydantic import BaseModel

class UserCreate(BaseModel):
    username: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class TokenData(BaseModel):
    username: str | None = None

class UserInfo(BaseModel):
    id: int
    username: str
    is_online: bool
    
    class Config:
        from_attributes = True

class RoomCreate(BaseModel):
    name: str

class RoomInfo(BaseModel):
    id: int
    name: str
    created_by: int
    created_at: datetime
    member_count: int
    
    class Config:
        from_attributes = True

class MessageInfo(BaseModel):
    id: int
    sender_id: int
    receiver_id: Optional[int] = None
    room_id: Optional[int] = None
    sender_username: str
    receiver_username: Optional[str] = None
    room_name: Optional[str] = None
    message_type: str
    ciphertext: str
    iv: str
    timestamp: datetime
    
    class Config:
        from_attributes = True

app = FastAPI()

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], # Frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database session dependency
def get_session():
    with Session(engine) as session:
        yield session

@app.on_event("startup")
def on_startup():
    create_db_and_tables()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# --- Helper to get current user from token ---
async def get_current_user_from_token(token: str, session: Session):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        user = session.exec(select(User).where(User.username == username)).first()
        if user is None:
            raise credentials_exception
        return user
    except JWTError:
        raise credentials_exception

async def get_current_user(token: str = Depends(oauth2_scheme), session: Session = Depends(get_session)):
    return await get_current_user_from_token(token, session)

# --- REST API Endpoints ---
@app.post("/signup", status_code=status.HTTP_201_CREATED)
def signup(user: UserCreate, session: Session = Depends(get_session)):
    db_user = session.exec(select(User).where(User.username == user.username)).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    hashed_password = get_password_hash(user.password)
    new_user = User(username=user.username, hashed_password=hashed_password)
    session.add(new_user)
    session.commit()
    session.refresh(new_user)
    access_token = create_access_token(data={"sub": new_user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/login")
def login(user: UserLogin, session: Session = Depends(get_session)):
    db_user = session.exec(select(User).where(User.username == user.username)).first()
    if not db_user or not verify_password(user.password, db_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": db_user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users", response_model=List[UserInfo])
async def get_users(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    users = session.exec(select(User).where(User.username != current_user.username)).all()
    return users

@app.get("/rooms", response_model=List[RoomInfo])
async def get_rooms(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    """Get all rooms that the current user is a member of"""
    rooms = session.exec(
        select(Room)
        .join(RoomMember, Room.id == RoomMember.room_id)
        .where(RoomMember.user_id == current_user.id, RoomMember.is_active == True, Room.is_active == True)
    ).all()
    
    # Add member count to each room
    result = []
    for room in rooms:
        member_count = session.exec(
            select(RoomMember).where(RoomMember.room_id == room.id, RoomMember.is_active == True)
        ).count()
        result.append(RoomInfo(
            id=room.id,
            name=room.name,
            created_by=room.created_by,
            created_at=room.created_at,
            member_count=member_count
        ))
    
    return result

@app.post("/rooms", response_model=RoomInfo)
async def create_room(room: RoomCreate, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    """Create a new room"""
    # Check if room name already exists
    existing_room = session.exec(select(Room).where(Room.name == room.name)).first()
    if existing_room:
        raise HTTPException(status_code=400, detail="Room name already exists")
    
    # Create room
    new_room = Room(name=room.name, created_by=current_user.id)
    session.add(new_room)
    session.commit()
    session.refresh(new_room)
    
    # Add creator as member
    member = RoomMember(room_id=new_room.id, user_id=current_user.id)
    session.add(member)
    session.commit()
    
    return RoomInfo(
        id=new_room.id,
        name=new_room.name,
        created_by=new_room.created_by,
        created_at=new_room.created_at,
        member_count=1
    )

@app.post("/rooms/{room_id}/join")
async def join_room(room_id: int, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    """Join a room"""
    # Check if room exists
    room = session.exec(select(Room).where(Room.id == room_id, Room.is_active == True)).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # Check if already a member
    existing_member = session.exec(
        select(RoomMember).where(RoomMember.room_id == room_id, RoomMember.user_id == current_user.id)
    ).first()
    
    if existing_member:
        if existing_member.is_active:
            raise HTTPException(status_code=400, detail="Already a member of this room")
        else:
            # Reactivate membership
            existing_member.is_active = True
            session.commit()
    else:
        # Add new member
        member = RoomMember(room_id=room_id, user_id=current_user.id)
        session.add(member)
        session.commit()
    
    return {"message": "Successfully joined room"}

@app.post("/rooms/{room_id}/leave")
async def leave_room(room_id: int, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    """Leave a room"""
    member = session.exec(
        select(RoomMember).where(RoomMember.room_id == room_id, RoomMember.user_id == current_user.id)
    ).first()
    
    if not member:
        raise HTTPException(status_code=404, detail="Not a member of this room")
    
    member.is_active = False
    session.commit()
    
    return {"message": "Successfully left room"}

@app.get("/messages/{other_user}", response_model=List[MessageInfo])
async def get_message_history(other_user: str, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    # Get the other user
    other_user_obj = session.exec(select(User).where(User.username == other_user)).first()
    if not other_user_obj:
        raise HTTPException(status_code=404, detail="User not found")
    
    messages = session.exec(
        select(Message).where(
            or_(
                (Message.sender_id == current_user.id) & (Message.receiver_id == other_user_obj.id),
                (Message.sender_id == other_user_obj.id) & (Message.receiver_id == current_user.id)
            )
        ).order_by(Message.timestamp)
    ).all()
    return messages

@app.get("/rooms/{room_id}/messages", response_model=List[MessageInfo])
async def get_room_messages(room_id: int, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    """Get message history for a room"""
    # Check if user is member of room
    member = session.exec(
        select(RoomMember).where(RoomMember.room_id == room_id, RoomMember.user_id == current_user.id, RoomMember.is_active == True)
    ).first()
    
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this room")
    
    messages = session.exec(
        select(Message).where(Message.room_id == room_id).order_by(Message.timestamp)
    ).all()
    
    return messages

# --- WebSocket Logic ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.user_typing: Dict[str, Dict[str, bool]] = {}  # room_id -> {username: is_typing}
        self.user_rooms: Dict[str, List[str]] = {}  # username -> [room_ids]

    async def connect(self, websocket: WebSocket, username: str):
        await websocket.accept()
        self.active_connections[username] = websocket
        self.user_rooms[username] = []
        
        # Update user online status
        with Session(engine) as session:
            user = session.exec(select(User).where(User.username == username)).first()
            if user:
                user.is_online = True
                session.commit()

    def disconnect(self, username: str):
        if username in self.active_connections:
            del self.active_connections[username]
            
        # Update user offline status
        with Session(engine) as session:
            user = session.exec(select(User).where(User.username == username)).first()
            if user:
                user.is_online = False
                session.commit()
        
        # Remove from typing indicators
        if username in self.user_rooms:
            for room_id in self.user_rooms[username]:
                if room_id in self.user_typing and username in self.user_typing[room_id]:
                    del self.user_typing[room_id][username]
            del self.user_rooms[username]

    async def broadcast(self, message: str):
        for connection in self.active_connections.values():
            await connection.send_text(message)
    
    async def send_private_message(self, message: str, username: str):
        if username in self.active_connections:
            await self.active_connections[username].send_text(message)
    
    async def send_room_message(self, message: str, room_id: str):
        """Send message to all users in a room"""
        with Session(engine) as session:
            members = session.exec(
                select(RoomMember).where(RoomMember.room_id == room_id, RoomMember.is_active == True)
            ).all()
            
            for member in members:
                username = session.exec(select(User).where(User.id == member.user_id)).first().username
                if username in self.active_connections:
                    await self.active_connections[username].send_text(message)
    
    def set_user_typing(self, username: str, room_id: str, is_typing: bool):
        """Set typing indicator for user in room"""
        if room_id not in self.user_typing:
            self.user_typing[room_id] = {}
        
        if is_typing:
            self.user_typing[room_id][username] = True
        else:
            if username in self.user_typing[room_id]:
                del self.user_typing[room_id][username]
    
    def get_typing_users(self, room_id: str) -> List[str]:
        """Get list of users currently typing in room"""
        return list(self.user_typing.get(room_id, {}).keys())
    
    def add_user_to_room(self, username: str, room_id: str):
        """Add user to room tracking"""
        if username not in self.user_rooms:
            self.user_rooms[username] = []
        if room_id not in self.user_rooms[username]:
            self.user_rooms[username].append(room_id)

    def get_online_users(self) -> List[str]:
        return list(self.active_connections.keys())

# Helper functions for WebSocket message handling
async def handle_private_message(sender_username: str, receiver_username: str, payload: dict, session: Session):
    """Handle private message processing"""
    try:
        # Get sender and receiver user IDs
        sender_user = session.exec(select(User).where(User.username == sender_username)).first()
        receiver_user = session.exec(select(User).where(User.username == receiver_username)).first()
        
        if not sender_user or not receiver_user:
            print(f"User not found: sender={sender_username}, receiver={receiver_username}")
            return
        
        # Save to DB
        db_message = Message(
            sender_id=sender_user.id,
            receiver_id=receiver_user.id,
            sender_username=sender_username,
            receiver_username=receiver_username,
            message_type="private",
            ciphertext=payload['ciphertext'],
            iv=payload['iv']
        )
        session.add(db_message)
        session.commit()
        session.refresh(db_message)

        # Create relay message
        relay_message = {
            "type": "private_message",
            "data": {
                "id": db_message.id,
                "sender_id": db_message.sender_id,
                "receiver_id": db_message.receiver_id,
                "sender_username": db_message.sender_username,
                "receiver_username": db_message.receiver_username,
                "message_type": db_message.message_type,
                "ciphertext": db_message.ciphertext,
                "iv": db_message.iv,
                "timestamp": db_message.timestamp.isoformat() if db_message.timestamp else None
            }
        }
        
        # Send message to receiver and sender
        await manager.send_private_message(json.dumps(relay_message), receiver_username)
        await manager.send_private_message(json.dumps(relay_message), sender_username)
        print(f"Private message relayed successfully from {sender_username} to {receiver_username}")
        
    except Exception as e:
        print(f"Error handling private message: {e}")

async def handle_group_message(sender_username: str, room_id: int, payload: dict, session: Session):
    """Handle group message processing"""
    try:
        # Get sender user ID
        sender_user = session.exec(select(User).where(User.username == sender_username)).first()
        if not sender_user:
            print(f"User not found: {sender_username}")
            return
        
        # Get room info
        room = session.exec(select(Room).where(Room.id == room_id)).first()
        if not room:
            print(f"Room not found: {room_id}")
            return
        
        # Save to DB
        db_message = Message(
            sender_id=sender_user.id,
            room_id=room_id,
            sender_username=sender_username,
            room_name=room.name,
            message_type="group",
            ciphertext=payload['ciphertext'],
            iv=payload['iv']
        )
        session.add(db_message)
        session.commit()
        session.refresh(db_message)

        # Create relay message
        relay_message = {
            "type": "group_message",
            "data": {
                "id": db_message.id,
                "sender_id": db_message.sender_id,
                "room_id": db_message.room_id,
                "sender_username": db_message.sender_username,
                "room_name": db_message.room_name,
                "message_type": db_message.message_type,
                "ciphertext": db_message.ciphertext,
                "iv": db_message.iv,
                "timestamp": db_message.timestamp.isoformat() if db_message.timestamp else None
            }
        }
        
        # Send message to all room members
        await manager.send_room_message(json.dumps(relay_message), str(room_id))
        print(f"Group message relayed successfully in room {room.name}")
        
    except Exception as e:
        print(f"Error handling group message: {e}")

async def broadcast_typing_indicator(room_id: int, typing_users: List[str]):
    """Broadcast typing indicator to room members"""
    if not typing_users:
        return
    
    typing_message = {
        "type": "typing_indicator",
        "data": {
            "room_id": room_id,
            "typing_users": typing_users
        }
    }
    
    await manager.send_room_message(json.dumps(typing_message), str(room_id))

manager = ConnectionManager()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(None)):
    print("WebSocket endpoint hit.")
    if token is None:
        print("Token is None. Closing WebSocket.")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    username = None
    try:
        print("Attempting to get current user from token.")
        # Create a new session for authentication
        with Session(engine) as auth_session:
            user = await get_current_user_from_token(token, auth_session)
            print(f"User obtained: {user.username if user else 'None'}")
            if not user:
                print("User not found or invalid. Closing WebSocket.")
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                return
            username = user.username
        
        print(f"Connecting WebSocket for user: {username}")
        await manager.connect(websocket, username)
        print(f"WebSocket connected for user: {username}")
        
        # Broadcast updated user list
        print("Broadcasting updated user list.")
        online_users = manager.get_online_users()
        await manager.broadcast(json.dumps({"type": "user_list", "data": online_users}))
        print("User list broadcasted. Entering message receive loop.")

        try:
            while True:
                data = await websocket.receive_text()
                message_data = json.loads(data)
                message_type = message_data.get("type", "private")
                
                if message_type == "private":
                    # Handle private message
                    receiver = message_data.get("receiver")
                    payload = message_data.get("payload")
                    
                    if receiver and payload:
                        with Session(engine) as msg_session:
                            await handle_private_message(username, receiver, payload, msg_session)
                        
                elif message_type == "group":
                    # Handle group message
                    room_id = message_data.get("room_id")
                    payload = message_data.get("payload")
                    
                    if room_id and payload:
                        with Session(engine) as msg_session:
                            await handle_group_message(username, room_id, payload, msg_session)
                        
                elif message_type == "typing_start":
                    # Handle typing indicator start
                    room_id = message_data.get("room_id")
                    if room_id:
                        manager.set_user_typing(username, str(room_id), True)
                        await broadcast_typing_indicator(room_id, manager.get_typing_users(str(room_id)))
                        
                elif message_type == "typing_stop":
                    # Handle typing indicator stop
                    room_id = message_data.get("room_id")
                    if room_id:
                        manager.set_user_typing(username, str(room_id), False)
                        await broadcast_typing_indicator(room_id, manager.get_typing_users(str(room_id)))
                            
        except WebSocketDisconnect:
            print(f"WebSocket disconnected for user: {username}")
        except Exception as loop_error:
            print(f"Error in message loop: {loop_error}")
        finally:
            # Clean disconnect
            if username:
                print(f"Cleaning up connection for user: {username}")
                manager.disconnect(username)
                # Broadcast updated user list after disconnect
                try:
                    online_users = manager.get_online_users()
                    await manager.broadcast(json.dumps({"type": "user_list", "data": online_users}))
                    print(f"Clean up complete for user: {username}")
                except Exception as cleanup_error:
                    print(f"Error during cleanup: {cleanup_error}")

    except HTTPException as e:
        print(f"HTTPException caught: {e.detail}. Closing WebSocket.")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
    except Exception as e:
        print(f"An unexpected error occurred: {e}. Closing WebSocket.")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
