import { useAuthStore } from '@/stores/authStore';
import { Navigate, Outlet } from 'react-router-dom';
import { Header } from './Header';

export function AppLayout() {
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col">
            <Header />
            <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl animate-in fade-in duration-500">
                <Outlet />
            </main>
        </div>
    );
}
