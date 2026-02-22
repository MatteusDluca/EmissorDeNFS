import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';
import { FileSignature, FileText, LayoutDashboard, LogOut } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

export function Header() {
    const logout = useAuthStore((state) => state.logout);
    const location = useLocation();

    const navItems = [
        { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
        { name: 'Nova Venda', path: '/sales', icon: FileText },
        { name: 'Certificado', path: '/certificates', icon: FileSignature },
    ];

    return (
        <header className="sticky top-0 z-50 w-full border-b border-white/[0.04] bg-black/60 backdrop-blur-md supports-[backdrop-filter]:bg-black/40 transition-colors">
            <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                <div className="flex items-center gap-8">
                    <div className="flex items-center gap-2 group cursor-pointer">
                        <div className="w-8 h-8 rounded-md bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-white/10 transition-all">
                            <FileSignature className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-semibold text-lg tracking-tight hidden sm:inline-block text-white/95">
                            NFS-e
                        </span>
                    </div>

                    <nav className="flex items-center gap-4 ml-4">
                        {navItems.map((item) => {
                            const isActive = location.pathname.startsWith(item.path);
                            const Icon = item.icon;
                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className={`flex items-center gap-2 text-sm transition-all duration-200 ${isActive
                                        ? 'text-white font-medium drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]'
                                        : 'text-zinc-500 hover:text-white'
                                        }`}
                                >
                                    <Icon className="w-4 h-4" />
                                    <span className="hidden sm:inline-block tracking-tight">{item.name}</span>
                                </Link>
                            );
                        })}
                    </nav>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={logout}
                        className="text-muted-foreground hover:text-foreground"
                    >
                        <LogOut className="w-4 h-4 mr-2" />
                        <span className="hidden sm:inline-block">Sair</span>
                    </Button>
                </div>
            </div>
        </header>
    );
}
