import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            const response = await fetch('http://localhost:8000/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            if (!response.ok) {
                throw new Error('Login failed');
            }
            const data = await response.json();
            login(data.access_token); // Use context login function
        } catch (err) {
            setError('Invalid username or password.');
        }
    };

    return (
        <div className="flex items-center justify-center h-screen bg-gray-100">
            <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
                <h2 className="text-2xl font-bold text-center text-gray-900">Login</h2>
                <form className="space-y-6" onSubmit={handleSubmit}>
                    <div>
                        <label className="sr-only">Username</label>
                        <input type="text" placeholder="Username" required value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-4 py-2 border rounded-md" />
                    </div>
                    <div>
                        <label className="sr-only">Password</label>
                        <input type="password" placeholder="Password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-2 border rounded-md" />
                    </div>
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    <button type="submit" className="w-full px-4 py-2 font-bold text-white bg-blue-500 rounded-md hover:bg-blue-600">Login</button>
                </form>
                <p className="text-sm text-center text-gray-600">
                    Don't have an account? <Link to="/signup" className="font-medium text-blue-500 hover:underline">Sign up</Link>
                </p>
            </div>
        </div>
    );
}