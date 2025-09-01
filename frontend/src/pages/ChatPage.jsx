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
        if (messageInput.trim() && isWsConnected && sessionKey) {
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
            <div className="p-4 bg-white border-b border-gray-200 shadow-sm">
                <h2 className="text-xl font-bold text-gray-800">{otherUsername}</h2>
                <p className={`text-xs font-semibold ${isWsConnected ? 'text-green-600' : 'text-red-500'}`}>
                    {isWsConnected ? '🔒 Encrypted & Connected' : 'Connecting...'}
                </p>
            </div>
            <div className="flex-1 p-4 overflow-y-auto bg-blue-50">
                {messages.map((msg) => (
                    <ChatMessage 
                        key={msg.id}
                        msg={msg} 
                        sessionKey={sessionKey} 
                        currentUserUsername={user.sub}
                    />
                ))}
                <div ref={messagesEndRef} />
            </div>
            <div className="p-4 bg-white border-t border-gray-200">
                <form onSubmit={handleSendMessage} className="flex items-center space-x-3">
                    <input
                        type="text"
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        placeholder={`Message ${otherUsername}...`}
                        className="flex-1 px-4 py-2 bg-messenger-gray border border-transparent rounded-full focus:outline-none focus:ring-2 focus:ring-messenger-blue"
                    />
                    <button type="submit" className="px-5 py-2 font-bold text-white bg-messenger-blue rounded-full hover:bg-blue-600 disabled:bg-gray-400"
                        disabled={!messageInput.trim() || !sessionKey || !isWsConnected}>
                        Send
                    </button>
                </form>
            </div>
        </div>
    );
}