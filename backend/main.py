
import json
from typing import List, Dict
from datetime import datetime

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select
from sqlalchemy import or_

from database import engine, create_db_and_tables
from models import User, Message
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
    username: str

class MessageInfo(BaseModel):
    id: int
    sender_username: str
    receiver_username: str
    ciphertext: str
    iv: str
    timestamp: datetime

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

@app.get("/messages/{other_user}", response_model=List[MessageInfo])
async def get_message_history(other_user: str, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    messages = session.exec(
        select(Message).where(
            or_(
                (Message.sender_username == current_user.username) & (Message.receiver_username == other_user),
                (Message.sender_username == other_user) & (Message.receiver_username == current_user.username)
            )
        ).order_by(Message.timestamp)
    ).all()
    return messages

# --- WebSocket Logic ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, username: str):
        await websocket.accept()
        self.active_connections[username] = websocket

    def disconnect(self, username: str):
        if username in self.active_connections:
            del self.active_connections[username]

    async def broadcast(self, message: str):
        for connection in self.active_connections.values():
            await connection.send_text(message)
    
    async def send_private_message(self, message: str, username: str):
        if username in self.active_connections:
            await self.active_connections[username].send_text(message)

    def get_online_users(self) -> List[str]:
        return list(self.active_connections.keys())

manager = ConnectionManager()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(None), session: Session = Depends(get_session)):
    if token is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    try:
        user = await get_current_user_from_token(token, session)
        if not user:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
            
        username = user.username
        await manager.connect(websocket, username)
        
        # Broadcast updated user list
        online_users = manager.get_online_users()
        await manager.broadcast(json.dumps({"type": "user_list", "data": online_users}))

        try:
            while True:
                data = await websocket.receive_text()
                message_data = json.loads(data)
                receiver = message_data.get("receiver")
                payload = message_data.get("payload")

                if receiver and payload:
                    # 1. Save to DB
                    db_message = Message(
                        sender_username=username,
                        receiver_username=receiver,
                        ciphertext=payload['ciphertext'],
                        iv=payload['iv']
                    )
                    session.add(db_message)
                    session.commit()
                    session.refresh(db_message)

                    # 2. Relay message to receiver and sender
                    relay_message = {
                        "type": "private_message",
                        "data": {**MessageInfo.from_orm(db_message).dict(), "id": db_message.id}
                    }
                    await manager.send_private_message(json.dumps(relay_message), receiver)
                    await manager.send_private_message(json.dumps(relay_message), username) # Send back to self
        except WebSocketDisconnect:
            # This is expected when the client disconnects
            pass
        finally:
            # Clean disconnect
            manager.disconnect(username)
            # Broadcast updated user list after disconnect
            online_users = manager.get_online_users()
            await manager.broadcast(json.dumps({"type": "user_list", "data": online_users}))

    except HTTPException:
        # This will catch auth errors from get_current_user_from_token
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
