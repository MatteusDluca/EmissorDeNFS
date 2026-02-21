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
        <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                <div className="flex items-center gap-8">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                            <FileSignature className="w-4 h-4 text-primary" />
                        </div>
                        <span className="font-semibold text-lg tracking-tight hidden sm:inline-block">
                            NFS-e
                        </span>
                    </div>

                    <nav className="flex items-center gap-1">
                        {navItems.map((item) => {
                            const isActive = location.pathname.startsWith(item.path);
                            const Icon = item.icon;
                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive
                                            ? 'bg-secondary text-secondary-foreground'
                                            : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                                        }`}
                                >
                                    <Icon className="w-4 h-4" />
                                    <span className="hidden sm:inline-block">{item.name}</span>
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
