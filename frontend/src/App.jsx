
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ChatLayout from './pages/ChatLayout';
import ChatPage from './pages/ChatPage';
import WelcomePage from './pages/WelcomePage';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
    return (
        <Router>
            <AuthProvider>
                <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/signup" element={<SignupPage />} />
                    <Route 
                        path="/" 
                        element={
                            <ProtectedRoute>
                                <ChatLayout />
                            </ProtectedRoute>
                        }
                    >
                        <Route index element={<WelcomePage />} />
                        <Route path="chat/:otherUsername" element={<ChatPage />} />
                    </Route>
                </Routes>
            </AuthProvider>
        </Router>
    );
}

export default App;
