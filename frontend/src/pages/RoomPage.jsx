import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getDeterministicSessionKey, encryptMessage } from '../utils/crypto';
import ChatMessage from '../components/ChatMessage';

export default function RoomPage() {
    const [messages, setMessages] = useState([]);
    const [messageInput, setMessageInput] = useState('');
    const [sessionKey, setSessionKey] = useState(null);
    const [isWsConnected, setIsWsConnected] = useState(false);
    const [roomInfo, setRoomInfo] = useState(null);
    const [typingUsers, setTypingUsers] = useState([]);
    const [isTyping, setIsTyping] = useState(false);
    const { roomId } = useParams();
    const { user, token } = useAuth();
    const ws = useRef(null);
    const messagesEndRef = useRef(null);
    const typingTimeoutRef = useRef(null);

    useEffect(() => {
        const setupAndConnect = async () => {
            if (!user?.sub || !roomId || !token) return;

            // 1. Fetch room info and generate key
            setMessages([]);
            const key = await getDeterministicSessionKey(`room_${roomId}`, user.sub);
            setSessionKey(key);
            
            // Fetch room info
            const roomResponse = await fetch(`http://localhost:8000/rooms/${roomId}/messages`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (roomResponse.ok) {
                const history = await roomResponse.json();
                setMessages(history);
            }

            // 2. Establish WebSocket connection
            ws.current = new WebSocket(`ws://localhost:8000/ws?token=${token}`);

            ws.current.onopen = () => {
                console.log(`WebSocket connection established for room ${roomId}`);
                setIsWsConnected(true);
            };

            ws.current.onmessage = (event) => {
                const response = JSON.parse(event.data);
                if (response.type === 'group_message' && response.data.room_id === parseInt(roomId)) {
                    setMessages(prev => [...prev, response.data]);
                } else if (response.type === 'typing_indicator' && response.data.room_id === parseInt(roomId)) {
                    setTypingUsers(response.data.typing_users.filter(u => u !== user.sub));
                }
            };

            ws.current.onerror = (error) => {
                console.error("WebSocket error:", error);
                setIsWsConnected(false);
            };

            ws.current.onclose = (event) => {
                console.log(`WebSocket connection closed. Code: ${event.code}`);
                setIsWsConnected(false);
            };
        };

        setupAndConnect();

        return () => {
            if (ws.current) {
                ws.current.close(1000, "Component unmounting");
            }
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
        };
    }, [roomId, user?.sub, token]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleTyping = () => {
        if (!isTyping) {
            setIsTyping(true);
            ws.current?.send(JSON.stringify({
                type: 'typing_start',
                room_id: roomId
            }));
        }

        // Clear existing timeout
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        // Set new timeout to stop typing indicator
        typingTimeoutRef.current = setTimeout(() => {
            setIsTyping(false);
            ws.current?.send(JSON.stringify({
                type: 'typing_stop',
                room_id: roomId
            }));
        }, 2000);
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!messageInput.trim()) return;
        
        if (ws.current && ws.current.readyState === WebSocket.OPEN && sessionKey) {
            try {
                const { ciphertext, iv } = await encryptMessage(messageInput, sessionKey);
                const messageToSend = { 
                    type: 'group',
                    room_id: parseInt(roomId),
                    payload: { ciphertext, iv } 
                };
                ws.current.send(JSON.stringify(messageToSend));
                setMessageInput('');
                
                // Stop typing indicator
                setIsTyping(false);
                ws.current.send(JSON.stringify({
                    type: 'typing_stop',
                    room_id: roomId
                }));
            } catch (error) {
                console.error("Encryption error:", error);
            }
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage(e);
        } else {
            handleTyping();
        }
    };

    return (
        <div className="flex flex-col flex-1">
            {/* Header */}
            <div className="p-4 bg-white border-b border-gray-200 shadow-sm">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                        🏠
                    </div>
                    <div className="flex-1">
                        <h2 className="text-xl font-bold text-gray-800">Group Chat</h2>
                        <p className="text-sm text-gray-600">🔒 Encrypted group conversation</p>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        isWsConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                        {isWsConnected ? '🟢 Connected' : '🔴 Disconnected'}
                    </div>
                </div>
            </div>
            
            {/* Messages area */}
            <div className="flex-1 p-4 overflow-y-auto bg-gradient-to-br from-purple-50 to-pink-50">
                {messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center text-gray-500">
                            <div className="text-6xl mb-4">🏠</div>
                            <p className="text-lg font-medium">No messages yet</p>
                            <p className="text-sm">Start the conversation in this group</p>
                        </div>
                    </div>
                ) : (
                    messages.map((msg, index) => (
                        <div 
                            key={msg.id} 
                            className="animate-fade-in"
                            style={{ animationDelay: `${index * 50}ms` }}
                        >
                            <ChatMessage 
                                msg={msg} 
                                sessionKey={sessionKey} 
                                currentUserUsername={user.sub}
                                isGroupChat={true}
                            />
                        </div>
                    ))
                )}
                
                {/* Typing indicator */}
                {typingUsers.length > 0 && (
                    <div className="flex items-center space-x-2 p-3 text-gray-500">
                        <div className="flex space-x-1">
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                        <span className="text-sm">
                            {typingUsers.length === 1 
                                ? `${typingUsers[0]} is typing...`
                                : `${typingUsers.join(', ')} are typing...`
                            }
                        </span>
                    </div>
                )}
                
                <div ref={messagesEndRef} />
            </div>
            
            {/* Message input */}
            <div className="p-4 bg-white border-t border-gray-200 shadow-lg">
                <form onSubmit={handleSendMessage} className="flex items-center space-x-3">
                    <div className="flex-1 relative">
                        <textarea
                            value={messageInput}
                            onChange={(e) => setMessageInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
                            className="w-full px-4 py-3 bg-gray-100 border border-transparent rounded-full focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all duration-200 pr-12 resize-none"
                            rows="1"
                            maxLength={500}
                        />
                        <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-400">
                            {messageInput.length}/500
                        </span>
                    </div>
                    <button 
                        type="submit" 
                        className={`px-6 py-3 font-semibold text-white rounded-full transition-all duration-200 ${
                            messageInput.trim() && sessionKey && isWsConnected
                                ? 'bg-purple-500 hover:bg-purple-600 shadow-md hover:shadow-lg transform hover:scale-105'
                                : 'bg-gray-400 cursor-not-allowed'
                        }`}
                        disabled={!messageInput.trim() || !sessionKey || !isWsConnected}
                    >
                        {isWsConnected ? 'Send' : 'Connecting...'}
                    </button>
                </form>
                {!isWsConnected && (
                    <p className="text-xs text-red-500 mt-2 text-center">
                        🔴 WebSocket disconnected. Trying to reconnect...
                    </p>
                )}
            </div>
        </div>
    );
}
