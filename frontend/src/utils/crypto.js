// Helper function to convert buffer to base64
function bufferToBase64(buffer) {
    return btoa(String.fromCharCode.apply(null, new Uint8Array(buffer)));
}

// Helper function to convert base64 to buffer
function base64ToBuffer(base64) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

const keyCache = new Map();

/**
 * Generates a deterministic 256-bit key for a pair of users using SHA-256.
 * @param {string} currentUser - The current user's username.
 * @param {string} otherUser - The other user's username.
 * @returns {Promise<CryptoKey>}
 */
export async function getDeterministicSessionKey(currentUser, otherUser) {
    const sortedUsernames = [currentUser, otherUser].sort().join(':');
    const cacheKey = sortedUsernames;

    if (keyCache.has(cacheKey)) {
        return keyCache.get(cacheKey);
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(sortedUsernames);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);

    const cryptoKey = await window.crypto.subtle.importKey(
        'raw',
        hashBuffer,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );

    keyCache.set(cacheKey, cryptoKey);
    return cryptoKey;
}

// ... (encryptMessage and decryptMessage functions remain the same)

/**
 * Encrypts a plaintext message using AES-GCM.
 * @param {string} plaintext
 * @param {CryptoKey} key
 * @returns {Promise<{ciphertext: string, iv: string}>}
 */
export async function encryptMessage(plaintext, key) {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encodedPlaintext = new TextEncoder().encode(plaintext);
    const ciphertext = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encodedPlaintext);
    return {
        ciphertext: bufferToBase64(ciphertext),
        iv: bufferToBase64(iv),
    };
}

/**
 * Decrypts a ciphertext using AES-GCM.
 * @param {string} ciphertext - Base64 encoded ciphertext
 * @param {CryptoKey} key
 * @param {string} iv - Base64 encoded IV
 * @returns {Promise<string|null>}
 */
export async function decryptMessage(ciphertext, key, iv) {
    try {
        const ciphertextBuffer = base64ToBuffer(ciphertext);
        const ivBuffer = base64ToBuffer(iv);
        const decryptedBuffer = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBuffer }, key, ciphertextBuffer);
        return new TextDecoder().decode(decryptedBuffer);
    } catch (e) {
        return null;
    }
}