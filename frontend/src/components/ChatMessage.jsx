
import { useState, useEffect } from 'react';
import { decryptMessage } from '../utils/crypto';

export default function ChatMessage({ msg, sessionKey, currentUserUsername }) {
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

    const isMyMessage = msg.username === currentUserUsername;

    return (
        <div className={`flex my-2 ${isMyMessage ? 'justify-end' : 'justify-start'}`}>
            <div className={`py-2 px-4 rounded-2xl max-w-lg lg:max-w-xl xl:max-w-2xl ${isMyMessage ? 'bg-messenger-blue text-white' : 'bg-messenger-gray text-gray-900'}`}>
                {!isMyMessage && <p className="text-xs font-bold text-gray-500">{msg.username}</p>}
                <p className="text-sm">{plaintext}</p>
            </div>
        </div>
    );
}
