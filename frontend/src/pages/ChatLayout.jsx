
import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";

export default function ChatLayout() {
    return (
        <div className="flex h-screen font-sans bg-white text-gray-900">
            <Sidebar />
            <Outlet />
        </div>
    );
}
