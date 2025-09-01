
import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Sidebar() {
    const [users, setUsers] = useState([]);
    const { token, logout } = useAuth();

    useEffect(() => {
        const fetchUsers = async () => {
            const response = await fetch('http://localhost:8000/users', {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            const data = await response.json();
            setUsers(data);
        };
        if (token) fetchUsers();
    }, [token]);

    return (
        <div className="w-1/5 bg-messenger-gray border-r border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-bold">Chats</h2>
            </div>
            <ul className="flex-1 p-2 overflow-y-auto">
                {users.map(user => (
                    <li key={user.username}>
                        <NavLink to={`/chat/${user.username}`} className={({ isActive }) => 
                            `flex items-center p-2 space-x-3 rounded-md hover:bg-gray-200 ${isActive ? 'bg-gray-300' : ''}`
                        }>
                            <span className="relative flex items-center justify-center w-10 h-10 bg-gray-300 rounded-full font-bold text-gray-600">
                                {user.username.charAt(0).toUpperCase()}
                            </span>
                            <span className="text-sm font-medium">{user.username}</span>
                        </NavLink>
                    </li>
                ))}
            </ul>
            <div className="p-4 border-t border-gray-200">
                <button onClick={logout} className="w-full px-4 py-2 font-bold text-white bg-red-500 rounded-md hover:bg-red-600">
                    Logout
                </button>
            </div>
        </div>
    );
}
