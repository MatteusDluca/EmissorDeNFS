import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { zodResolver } from '@hookform/resolvers/zod';
import type { LoginDto } from '@nfse/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';

const loginSchema = z.object({
    username: z.string().min(1, 'Usuário é obrigatório'),
    password: z.string().min(1, 'Senha é obrigatória'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function Login() {
    const navigate = useNavigate();
    const setAuth = useAuthStore((state) => state.login);
    const [isLoading, setIsLoading] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<LoginFormValues>({
        resolver: zodResolver(loginSchema),
    });

    const onSubmit = async (data: LoginFormValues) => {
        try {
            setIsLoading(true);
            const payload: LoginDto = data;
            const response = await api.post('/auth/login', payload);

            const { accessToken } = response.data;
            setAuth(accessToken);
            toast.success('Login realizado com sucesso', {
                description: 'Bem-vindo de volta ao painel.',
            });
            navigate('/dashboard');
        } catch (error: any) {
            toast.error('Credenciais inválidas', {
                description: error.response?.data?.message || 'Verifique seus dados e tente novamente.',
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-black bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:24px_24px] relative overflow-hidden">
            <div className="absolute inset-0 bg-black [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,transparent_0%,black_100%)]"></div>

            <Card className="z-10 w-full max-w-md bg-card border border-white/[0.04] shadow-2xl relative animate-in fade-in slide-in-from-bottom-4 duration-700">
                <CardHeader className="space-y-2 text-center pb-6">
                    <div className="w-12 h-12 bg-white/5 rounded-md flex items-center justify-center mx-auto mb-4 border border-white/10">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-white"><path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                    </div>
                    <CardTitle className="text-2xl font-semibold tracking-tight text-white/95">NFS-e Emissor</CardTitle>
                    <CardDescription className="text-zinc-500">
                        Insira suas credenciais para acessar o painel
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        <fieldset disabled={isLoading} className="space-y-6 group disabled:opacity-80 transition-opacity">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="username" className="text-xs font-medium text-muted-foreground uppercase tracking-wider group-disabled:opacity-70">Usuário</Label>
                                    <Input
                                        id="username"
                                        placeholder="admin"
                                        className="bg-background/50 border-white/10 focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary transition-all rounded-md h-12"
                                        {...register('username')}
                                    />
                                    {errors.username && (
                                        <p className="text-xs text-destructive">{errors.username.message}</p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider group-disabled:opacity-70">Senha</Label>
                                    </div>
                                    <Input
                                        id="password"
                                        type="password"
                                        placeholder="••••••••"
                                        className="bg-background/50 border-white/10 focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary transition-all rounded-md h-12"
                                        {...register('password')}
                                    />
                                    {errors.password && (
                                        <p className="text-xs text-destructive">{errors.password.message}</p>
                                    )}
                                </div>
                            </div>
                            <Button
                                type="submit"
                                className="w-full h-12 font-medium bg-primary hover:bg-primary/90 text-primary-foreground transition-all rounded-md shadow-[0_0_20px_rgba(255,255,255,0.05)]"
                                isLoading={isLoading}
                            >
                                Acessar Plataforma
                            </Button>
                        </fieldset>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
