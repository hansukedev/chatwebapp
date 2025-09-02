
import { useState, useEffect } from 'react';
import { decryptMessage } from '../utils/crypto';

export default function ChatMessage({ msg, sessionKey, currentUserUsername, isGroupChat = false }) {
    const [plaintext, setPlaintext] = useState('...');

    useEffect(() => {
        const decrypt = async () => {
            if (sessionKey && msg.ciphertext) {
                const decrypted = await decryptMessage(msg.ciphertext, sessionKey, msg.iv);
                setPlaintext(decrypted || '[Encrypted Message: Decryption Failed]');
            } else {
                setPlaintext('[Waiting for key...]');
            }
        };

        decrypt();
    }, [msg, sessionKey]);

    // Compare usernames instead of IDs
    const isMyMessage = msg.sender_username === currentUserUsername;
    const timestamp = new Date(msg.timestamp).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });

    // Generate avatar color based on username
    const getAvatarColor = (username) => {
        const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500'];
        const index = username.charCodeAt(0) % colors.length;
        return colors[index];
    };

    return (
        <div className={`flex my-4 ${isMyMessage ? 'justify-end' : 'justify-start'}`}>
            {/* Avatar for other user's message (left side) */}
            {!isMyMessage && (
                <div className="flex-shrink-0 mr-3 self-end">
                    <div className={`w-10 h-10 rounded-full ${getAvatarColor(msg.sender_username)} flex items-center justify-center text-white text-sm font-bold shadow-md`}>
                        {msg.sender_username.charAt(0).toUpperCase()}
                    </div>
                </div>
            )}
            
            {/* Message content */}
            <div className={`flex flex-col ${isMyMessage ? 'items-end' : 'items-start'} max-w-xs lg:max-w-md xl:max-w-lg`}>
                {/* Show sender name in group chat */}
                {isGroupChat && !isMyMessage && (
                    <span className="text-xs font-medium text-gray-600 mb-1 ml-2">
                        {msg.sender_username}
                    </span>
                )}
                
                <div className={`py-3 px-4 rounded-2xl shadow-sm transition-all duration-200 hover:shadow-md ${
                    isMyMessage 
                        ? 'bg-blue-500 text-white rounded-br-md' 
                        : 'bg-gray-100 text-gray-900 rounded-bl-md'
                }`}>
                    <p className="text-sm leading-relaxed break-words">{plaintext}</p>
                </div>
                <span className={`text-xs text-gray-500 mt-2 ${isMyMessage ? 'mr-2' : 'ml-2'}`}>
                    {timestamp}
                </span>
            </div>
            
            {/* Avatar for my message (right side) */}
            {isMyMessage && (
                <div className="flex-shrink-0 ml-3 self-end">
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-md">
                        {currentUserUsername.charAt(0).toUpperCase()}
                    </div>
                </div>
            )}
        </div>
    );
}
