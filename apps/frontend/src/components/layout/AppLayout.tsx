import { useAuthStore } from '@/stores/authStore';
import { Navigate, Outlet } from 'react-router-dom';
import { Header } from './Header';

export function AppLayout() {
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col relative overflow-hidden">
            {/* Efeito Glow de Fundo Elegante Global */}
            <div className="pointer-events-none fixed inset-0 flex items-center justify-center bg-background [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)] z-0"></div>

            <div className="relative z-10 flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
