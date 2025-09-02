
import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Sidebar() {
    const [users, setUsers] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [showCreateRoom, setShowCreateRoom] = useState(false);
    const [newRoomName, setNewRoomName] = useState('');
    const { token, logout } = useAuth();

    useEffect(() => {
        const fetchData = async () => {
            if (token) {
                // Fetch users
                const usersResponse = await fetch('http://localhost:8000/users', {
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                const usersData = await usersResponse.json();
                setUsers(usersData);

                // Fetch rooms
                const roomsResponse = await fetch('http://localhost:8000/rooms', {
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                const roomsData = await roomsResponse.json();
                setRooms(roomsData);
            }
        };
        fetchData();
    }, [token]);

    const handleCreateRoom = async (e) => {
        e.preventDefault();
        if (!newRoomName.trim()) return;

        try {
            const response = await fetch('http://localhost:8000/rooms', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name: newRoomName.trim() }),
            });

            if (response.ok) {
                const newRoom = await response.json();
                setRooms(prev => [...prev, newRoom]);
                setNewRoomName('');
                setShowCreateRoom(false);
            }
        } catch (error) {
            console.error('Error creating room:', error);
        }
    };

    return (
        <div className="w-1/5 bg-messenger-gray border-r border-gray-200 flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-800">Secure Chat</h2>
                <p className="text-xs text-gray-600">🔒 End-to-End Encrypted</p>
            </div>

            {/* Create Room Button */}
            <div className="p-4 border-b border-gray-200">
                <button
                    onClick={() => setShowCreateRoom(!showCreateRoom)}
                    className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                >
                    ➕ Create Group Chat
                </button>
                
                {showCreateRoom && (
                    <form onSubmit={handleCreateRoom} className="mt-3 space-y-2">
                        <input
                            type="text"
                            value={newRoomName}
                            onChange={(e) => setNewRoomName(e.target.value)}
                            placeholder="Room name..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            maxLength={30}
                        />
                        <div className="flex space-x-2">
                            <button
                                type="submit"
                                className="flex-1 px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600"
                            >
                                Create
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowCreateRoom(false)}
                                className="flex-1 px-3 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                )}
            </div>

            {/* Group Chats */}
            {rooms.length > 0 && (
                <div className="p-4 border-b border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
                        🏠 Group Chats ({rooms.length})
                    </h3>
                    <ul className="space-y-1">
                        {rooms.map(room => (
                            <li key={room.id}>
                                <NavLink to={`/room/${room.id}`} className={({ isActive }) => 
                                    `flex items-center p-2 space-x-3 rounded-md hover:bg-gray-200 ${isActive ? 'bg-gray-300' : ''}`
                                }>
                                    <span className="relative flex items-center justify-center w-8 h-8 bg-purple-500 rounded-full font-bold text-white text-sm">
                                        🏠
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <span className="text-sm font-medium text-gray-900 block truncate">
                                            {room.name}
                                        </span>
                                        <span className="text-xs text-gray-500">
                                            {room.member_count} members
                                        </span>
                                    </div>
                                </NavLink>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Private Chats */}
            <div className="flex-1 p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
                    👤 Private Chats ({users.length})
                </h3>
                <ul className="space-y-1">
                    {users.map(user => (
                        <li key={user.username}>
                            <NavLink to={`/chat/${user.username}`} className={({ isActive }) => 
                                `flex items-center p-2 space-x-3 rounded-md hover:bg-gray-200 ${isActive ? 'bg-gray-300' : ''}`
                            }>
                                <span className="relative flex items-center justify-center w-8 h-8 bg-gray-500 rounded-full font-bold text-white text-sm">
                                    {user.username.charAt(0).toUpperCase()}
                                    {user.is_online && (
                                        <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
                                    )}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <span className="text-sm font-medium text-gray-900 block truncate">
                                        {user.username}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                        {user.is_online ? '🟢 Online' : '⚫ Offline'}
                                    </span>
                                </div>
                            </NavLink>
                        </li>
                    ))}
                </ul>
            </div>

            {/* Logout */}
            <div className="p-4 border-t border-gray-200">
                <button onClick={logout} className="w-full px-4 py-2 font-bold text-white bg-red-500 rounded-md hover:bg-red-600 transition-colors">
                    🚪 Logout
                </button>
            </div>
        </div>
    );
}
