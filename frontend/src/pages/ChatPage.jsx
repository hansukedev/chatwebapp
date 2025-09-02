import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getDeterministicSessionKey, encryptMessage } from '../utils/crypto';
import ChatMessage from '../components/ChatMessage';

export default function ChatPage() {
    const [messages, setMessages] = useState([]);
    const [messageInput, setMessageInput] = useState('');
    const [sessionKey, setSessionKey] = useState(null);
    const [isWsConnected, setIsWsConnected] = useState(false);
    const { otherUsername } = useParams();
    const { user, token } = useAuth();
    const ws = useRef(null);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        const setupAndConnect = async () => {
            if (!user?.sub || !otherUsername || !token) return;

            // 1. Fetch data and generate key
            setMessages([]);
            const key = await getDeterministicSessionKey(user.sub, otherUsername);
            setSessionKey(key);
            const response = await fetch(`http://localhost:8000/messages/${otherUsername}`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            const history = await response.json();
            setMessages(history);

            // 2. Establish new WebSocket connection
            ws.current = new WebSocket(`ws://localhost:8000/ws?token=${token}`);

            ws.current.onopen = () => {
                console.log(`WebSocket connection established for chat with ${otherUsername}`);
                setIsWsConnected(true);
            };

            ws.current.onmessage = (event) => {
                const response = JSON.parse(event.data);
                if (response.type === 'private_message') {
                    const msg = response.data;
                    if (msg.sender_username === otherUsername || (msg.sender_username === user.sub && msg.receiver_username === otherUsername)) {
                        setMessages(prev => [...prev, msg]);
                    }
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

        // The cleanup function will run when dependencies change or component unmounts
        return () => {
            if (ws.current) {
                ws.current.close(1000, "Component unmounting or dependency changed");
            }
        };
    }, [otherUsername, user?.sub, token]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!messageInput.trim()) return; // Prevent empty messages
        
        if (ws.current && ws.current.readyState === WebSocket.OPEN && sessionKey) {
            try {
                const { ciphertext, iv } = await encryptMessage(messageInput, sessionKey);
                const messageToSend = { 
                    receiver: otherUsername, 
                    payload: { ciphertext, iv } 
                };
                ws.current.send(JSON.stringify(messageToSend));
                setMessageInput('');
            } catch (error) {
                console.error("Encryption error:", error);
            }
        } else {
            console.log("Cannot send message. WebSocket not connected or session key not available.");
        }
    };

    return (
        <div className="flex flex-col flex-1">
            {/* Header with avatar and status */}
            <div className="p-4 bg-white border-b border-gray-200 shadow-sm">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                        {otherUsername.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                        <h2 className="text-xl font-bold text-gray-800">{otherUsername}</h2>
                        <p className="text-sm text-gray-600">🔒 Private encrypted chat</p>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        isWsConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                        {isWsConnected ? '🟢 Online' : '🔴 Offline'}
                    </div>
                </div>
            </div>
            
            {/* Messages area */}
            <div className="flex-1 p-4 overflow-y-auto bg-gradient-to-br from-blue-50 to-indigo-50">
                {messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center text-gray-500">
                            <div className="text-6xl mb-4">💬</div>
                            <p className="text-lg font-medium">No messages yet</p>
                            <p className="text-sm">Start a conversation with {otherUsername}</p>
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
                            />
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>
            
            {/* Message input */}
            <div className="p-4 bg-white border-t border-gray-200 shadow-lg">
                <form onSubmit={handleSendMessage} className="flex items-center space-x-3">
                    <div className="flex-1 relative">
                        <input
                            type="text"
                            value={messageInput}
                            onChange={(e) => setMessageInput(e.target.value)}
                            placeholder={`Message ${otherUsername}...`}
                            className="w-full px-4 py-3 bg-gray-100 border border-transparent rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all duration-200 pr-12"
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
                                ? 'bg-blue-500 hover:bg-blue-600 shadow-md hover:shadow-lg transform hover:scale-105'
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