import { useAuthStore } from '@/stores/authStore';
import { Navigate, Outlet } from 'react-router-dom';
import { Header } from './Header';

export function AppLayout() {
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return (
        <div className="min-h-screen bg-black text-white flex flex-col relative overflow-hidden selection:bg-primary/20">
            {/* Efeito Super Minimalista Linear Style: True Black com Grid Tênue */}
            <div className="pointer-events-none fixed inset-0 z-0 bg-black"></div>
            <div className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:24px_24px]">
                <div className="absolute inset-0 bg-black [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,transparent_0%,black_100%)]"></div>
            </div>

            <div className="relative z-10 flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
