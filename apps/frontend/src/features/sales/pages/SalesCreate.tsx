import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { zodResolver } from '@hookform/resolvers/zod';
import type { CreateSaleDto } from '@nfse/shared';
import { FileText, Send } from 'lucide-react';
import { useState } from 'react';
import type { SubmitHandler } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';

const saleSchema = z.object({
    externalId: z.string().min(1, 'ID do sistema origem é obrigatório'),
    tomakerName: z.string().min(3, 'Nome muito curto'),
    tomakerDocument: z.string().min(11, 'Documento inválido'),
    tomakerEmail: z.string().email('E-mail inválido'),
    serviceDescription: z.string().min(5, 'Descrição é obrigatória'),
    amount: z.coerce.number().min(0.01, 'O valor deve ser maior que zero'),
});

type SaleFormValues = z.infer<typeof saleSchema>;

export function SalesCreate() {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);

    const { register, handleSubmit, formState: { errors } } = useForm<SaleFormValues>({
        resolver: zodResolver(saleSchema) as any,
        defaultValues: {
            externalId: `venda-${Math.floor(Math.random() * 10000)}`,
            amount: 1500.00
        }
    });

    const onSubmit: SubmitHandler<SaleFormValues> = async (data) => {
        try {
            setIsLoading(true);
            const payload: CreateSaleDto = {
                ...data,
                tomakerDocument: data.tomakerDocument.replace(/\D/g, '')
            };

            const response = await api.post('/sales', payload);

            if (response.status === 202) {
                toast.success('Venda Recebida', {
                    description: 'A NFS-e foi colocada na fila de emissão assíncrona.'
                });
                navigate('/dashboard');
            }
        } catch (error: any) {
            toast.error('Erro ao emitir nota', {
                description: error.response?.data?.message || 'Verifique as informações da venda.'
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto py-8">
            <div className="mb-8 flex items-center gap-3">
                <div className="p-3 bg-primary/10 rounded-xl border border-primary/20">
                    <FileText className="w-6 h-6 text-primary" />
                </div>
                <div>
                    <h1 className="text-3xl font-semibold tracking-tight">Nova Venda</h1>
                    <p className="text-muted-foreground mt-1">Gere uma fatura e dispare o processamento assíncrono da NFS-e</p>
                </div>
            </div>

            <Card className="bg-card/40 border-white/5 shadow-xl backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="text-xl">Dados da Prestação de Serviço</CardTitle>
                    <CardDescription>
                        Ao salvar, a API responderá imediatamente (Status 202) e o Worker montará o XML em background.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        <fieldset disabled={isLoading} className="space-y-6 group disabled:opacity-80 transition-opacity">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <Label htmlFor="externalId" className="text-xs font-medium text-muted-foreground uppercase tracking-wider group-disabled:opacity-70">ID Origem (Seu Sistema)</Label>
                                    <Input id="externalId" className="bg-background/50 h-11" {...register('externalId')} />
                                    {errors.externalId && <p className="text-xs text-destructive">{errors.externalId.message}</p>}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="amount" className="text-xs font-medium text-muted-foreground uppercase tracking-wider group-disabled:opacity-70">Valor do Serviço (R$)</Label>
                                    <Input type="number" step="0.01" id="amount" className="bg-background/50 h-11" {...register('amount')} />
                                    {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
                                </div>
                            </div>

                            <div className="space-y-5 pt-4 border-t border-white/5">
                                <h3 className="text-sm font-medium text-foreground group-disabled:opacity-70">Tomador do Serviço (Cliente)</h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div className="space-y-2">
                                        <Label htmlFor="tomakerName" className="text-xs font-medium text-muted-foreground group-disabled:opacity-70">NOME / RAZÃO SOCIAL</Label>
                                        <Input id="tomakerName" placeholder="Empresa Cliente LTDA" className="bg-background/50 h-11" {...register('tomakerName')} />
                                        {errors.tomakerName && <p className="text-xs text-destructive">{errors.tomakerName.message}</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="tomakerDocument" className="text-xs font-medium text-muted-foreground group-disabled:opacity-70">CNPJ / CPF</Label>
                                        <Input id="tomakerDocument" placeholder="00.000.000/0001-00" className="bg-background/50 h-11" {...register('tomakerDocument')} />
                                        {errors.tomakerDocument && <p className="text-xs text-destructive">{errors.tomakerDocument.message}</p>}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="tomakerEmail" className="text-xs font-medium text-muted-foreground group-disabled:opacity-70">E-MAIL DO TOMADOR</Label>
                                    <Input id="tomakerEmail" type="email" placeholder="financeiro@empresa.com" className="bg-background/50 h-11" {...register('tomakerEmail')} />
                                    {errors.tomakerEmail && <p className="text-xs text-destructive">{errors.tomakerEmail.message}</p>}
                                </div>
                            </div>

                            <div className="space-y-2 pt-4 border-t border-white/5">
                                <Label htmlFor="serviceDescription" className="text-xs font-medium text-muted-foreground uppercase tracking-wider group-disabled:opacity-70">Descrição dos Serviços (Corpo da NF)</Label>
                                <Input id="serviceDescription" placeholder="Desenvolvimento de software..." className="bg-background/50 h-11" {...register('serviceDescription')} />
                                {errors.serviceDescription && <p className="text-xs text-destructive">{errors.serviceDescription.message}</p>}
                            </div>

                            <div className="pt-4">
                                <Button type="submit" className="w-full h-12 font-medium bg-primary hover:bg-primary/90 transition-all gap-2" isLoading={isLoading}>
                                    {!isLoading && <Send className="w-4 h-4" />}
                                    Finalizar Venda e Emitir NFS-e
                                </Button>
                            </div>
                        </fieldset>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
