import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import type { CertificateResponseDto, KpiResponseDto, NoteResponseDto } from '@nfse/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, AlertCircle, CheckCircle2, Clock, DollarSign, FileCode2, RefreshCw, Send, ShieldCheck, XCircle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export function Dashboard() {


    const queryClient = useQueryClient();
    const [statusFilter, setStatusFilter] = useState<string>('all');

    const fetchNotes = async (): Promise<NoteResponseDto[]> => {
        const response = await api.get('/notes', { params: statusFilter !== 'all' ? { status: statusFilter } : {} });
        return response.data.notes || [];
    };

    const fetchCertificates = async (): Promise<CertificateResponseDto[]> => {
        const response = await api.get('/certificates');
        return response.data;
    };

    const fetchKpi = async (): Promise<KpiResponseDto> => {
        const response = await api.get('/notes/kpi');
        return response.data;
    };

    const retryMutation = useMutation({
        mutationFn: async (noteId: string) => {
            const response = await api.post(`/notes/${noteId}/retry`);
            return response.data;
        },
        onSuccess: () => {
            toast.success('Reprocessamento Iniciado', { description: 'A nota retornou para a fila com sucesso.' });
            queryClient.invalidateQueries({ queryKey: ['notes'] });
            queryClient.invalidateQueries({ queryKey: ['kpi'] });
        },
        onError: (error: any) => {
            toast.error('Erro no Reenvio', { description: error.response?.data?.message || 'Falha ao reprocessar a nfse.' });
        }
    });

    const { data: notes, isLoading, isFetching: isFetchingNotes, isError, refetch: refetchNotes } = useQuery({
        queryKey: ['notes', statusFilter],
        queryFn: fetchNotes,
        refetchInterval: (query) => {
            const data = query.state?.data;
            if (!data || !Array.isArray(data)) return false;
            const isProcessing = data.some((note: NoteResponseDto) => note.status === 'PROCESSING' || note.status === 'PENDING');
            return isProcessing ? 3000 : false;
        },
    });

    const { data: kpi, refetch: refetchKpi, isFetching: isFetchingKpi } = useQuery({
        queryKey: ['kpi'],
        queryFn: fetchKpi,
        refetchInterval: 3000,
    });

    const isGlobalFetching = isFetchingNotes || isFetchingKpi;

    const handleRefetch = () => {
        refetchNotes();
        refetchKpi();
    };

    const { data: certs, isLoading: isLoadingCerts, isError: isErrorCerts } = useQuery({
        queryKey: ['certificates'],
        queryFn: fetchCertificates,
    });

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'SUCCESS':
                return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20"><CheckCircle2 className="w-3 h-3 mr-1" /> Emitida</Badge>;
            case 'PROCESSING':
                return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20"><Activity className="w-3 h-3 mr-1 animate-pulse" /> Processando</Badge>;
            case 'PENDING':
                return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 hover:bg-blue-500/20"><Clock className="w-3 h-3 mr-1" /> Na Fila</Badge>;
            case 'ERROR':
                return <Badge className="bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20"><AlertCircle className="w-3 h-3 mr-1" /> Falha</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    return (
        <div className="max-w-7xl mx-auto py-8 space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-semibold tracking-tight">Painel Resumo (Real-time)</h1>
                    <p className="text-muted-foreground mt-1">Acompanhe as emissões de Notas Fiscais, KPIs e seus certificados instalados.</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleRefetch} className="gap-2" isLoading={isGlobalFetching && !isLoading}>
                    {!isGlobalFetching && <RefreshCw className="w-4 h-4" />}
                    Atualizar Painel
                </Button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-card/60 to-transparent border-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md p-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100 fill-mode-both hover:-translate-y-1 transition-transform">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium mb-2">
                        <DollarSign className="w-4 h-4" /> Volume Transacionado
                    </div>
                    <div className="text-2xl font-bold">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(kpi?.totalAmount || 0)}
                    </div>
                </Card>
                <Card className="bg-gradient-to-br from-emerald-500/10 to-transparent border-emerald-500/20 shadow-[inset_0_1px_0_rgba(16,185,129,0.1)] backdrop-blur-md p-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200 fill-mode-both hover:-translate-y-1 transition-transform">
                    <div className="flex items-center gap-2 text-emerald-500 text-sm font-medium mb-2">
                        <CheckCircle2 className="w-4 h-4" /> Faturas Emitidas
                    </div>
                    <div className="text-2xl font-bold text-emerald-500">{kpi?.totalSuccess || 0}</div>
                </Card>
                <Card className="bg-gradient-to-br from-amber-500/10 to-transparent border-amber-500/20 shadow-[inset_0_1px_0_rgba(245,158,11,0.1)] backdrop-blur-md p-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300 fill-mode-both hover:-translate-y-1 transition-transform">
                    <div className="flex items-center gap-2 text-amber-500 text-sm font-medium mb-2">
                        <Activity className="w-4 h-4" /> Em Processamento
                    </div>
                    <div className="text-2xl font-bold text-amber-500">{kpi?.totalProcessing || 0}</div>
                </Card>
                <Card className="bg-gradient-to-br from-destructive/10 to-transparent border-destructive/20 shadow-[inset_0_1px_0_rgba(239,68,68,0.1)] backdrop-blur-md p-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-400 fill-mode-both hover:-translate-y-1 transition-transform">
                    <div className="flex items-center gap-2 text-destructive text-sm font-medium mb-2">
                        <XCircle className="w-4 h-4" /> Falhas de Emissão
                    </div>
                    <div className="text-2xl font-bold text-destructive">{kpi?.totalFailed || 0}</div>
                </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* Painel Esquerdo: Notas (col-span-2) */}
                <Card className="xl:col-span-2 bg-card/50 border-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] backdrop-blur-xl overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-6 duration-700 delay-500 fill-mode-both">
                    <div className="p-4 border-b border-white/5 bg-muted/20 flex items-center justify-between">
                        <h2 className="font-semibold flex items-center gap-2"><FileCode2 className="w-4 h-4 opacity-70" /> Histórico de Notas Fiscais</h2>

                        <div className="flex gap-2">
                            <Button
                                variant={statusFilter === 'all' ? 'default' : 'secondary'}
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => setStatusFilter('all')}
                            >
                                Todas
                            </Button>
                            <Button
                                variant={statusFilter === 'SUCCESS' ? 'default' : 'secondary'}
                                size="sm"
                                className={`h-7 text-xs ${statusFilter !== 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20' : ''}`}
                                onClick={() => setStatusFilter('SUCCESS')}
                            >
                                Sucesso
                            </Button>
                            <Button
                                variant={statusFilter === 'ERROR' ? 'default' : 'secondary'}
                                size="sm"
                                className={`h-7 text-xs ${statusFilter !== 'ERROR' ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' : ''}`}
                                onClick={() => setStatusFilter('ERROR')}
                            >
                                Falhas
                            </Button>
                        </div>
                    </div>
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow className="border-white/5 hover:bg-transparent">
                                <TableHead className="w-[120px]">Venda ID</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Protocolo</TableHead>
                                <TableHead>Tentativas</TableHead>
                                <TableHead className="text-right">Criada Em</TableHead>
                                <TableHead className="w-[100px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i} className="border-white/5">
                                        <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-24 rounded-full" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-8" /></TableCell>
                                        <TableCell className="text-right"><Skeleton className="h-5 w-32 ml-auto" /></TableCell>
                                        <TableCell><Skeleton className="h-8 w-8 rounded-md" /></TableCell>
                                    </TableRow>
                                ))
                            ) : isError ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center h-32 text-destructive">Falha ao se conectar com a API.</TableCell>
                                </TableRow>
                            ) : !Array.isArray(notes) || notes.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center h-48 text-muted-foreground">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <FileCode2 className="w-8 h-8 opacity-20" />
                                            <span>Nenhuma fatura foi processada ainda.</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                notes.map((note) => (
                                    <TableRow key={note.id} className="border-white/5 hover:bg-white/5 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] transition-all duration-200">
                                        <TableCell className="font-medium text-xs font-mono text-muted-foreground">
                                            {note.externalId}
                                        </TableCell>
                                        <TableCell>
                                            {getStatusBadge(note.status)}
                                        </TableCell>
                                        <TableCell className="text-xs font-mono opacity-80">
                                            {note.protocol || '-'}
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-xs text-muted-foreground">{note.attempts} / 3</span>
                                        </TableCell>
                                        <TableCell className="text-right text-sm text-muted-foreground">
                                            {new Date(note.createdAt).toLocaleString('pt-BR')}
                                        </TableCell>
                                        <TableCell className="text-right">

                                            {/* Modal Details */}
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button variant="ghost" size="sm" className="h-8 text-xs hover:bg-primary/20 hover:text-primary">
                                                        Detalhes
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent className="sm:max-w-[700px] bg-background/95 backdrop-blur-3xl border-white/10 shadow-2xl">
                                                    <DialogHeader>
                                                        <DialogTitle className="flex items-center gap-3">
                                                            Detalhes da Emissão
                                                            {getStatusBadge(note.status)}
                                                        </DialogTitle>
                                                        {note.status === 'ERROR' && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => retryMutation.mutate(note.id)}
                                                                isLoading={retryMutation.isPending}
                                                                className="ml-auto flex border-destructive/50 text-destructive hover:bg-destructive/10 gap-2"
                                                            >
                                                                {!retryMutation.isPending && <Send className="w-4 h-4" />}
                                                                Tentar Novamente
                                                            </Button>
                                                        )}
                                                    </DialogHeader>
                                                    <DialogDescription>
                                                        ID Trace: <code className="text-xs ml-1">{note.id}</code>
                                                    </DialogDescription>

                                                    <div className="mt-4 space-y-4">
                                                        {note.errorMessage && (
                                                            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                                                                <h4 className="text-sm font-semibold text-destructive mb-1 flex items-center gap-2">
                                                                    <AlertCircle className="w-4 h-4" /> Resposta da Prefeitura (Erro)
                                                                </h4>
                                                                <p className="text-sm font-mono text-destructive/90 break-all">{note.errorMessage}</p>
                                                            </div>
                                                        )}

                                                        {note.protocol && (
                                                            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                                                                <h4 className="text-sm font-semibold text-emerald-500 mb-1 flex items-center gap-2">
                                                                    <CheckCircle2 className="w-4 h-4" /> Resposta da Prefeitura (Sucesso)
                                                                </h4>
                                                                <p className="text-sm font-mono text-emerald-500/90 break-all">Protocolo oficial recebido via XML: {note.protocol}</p>
                                                            </div>
                                                        )}

                                                        <div className="rounded-lg border border-white/10 overflow-hidden bg-[#1e1e1e]">
                                                            <div className="px-4 py-2 bg-black/40 border-b border-white/10 flex items-center gap-2">
                                                                <FileCode2 className="w-4 h-4 text-muted-foreground" />
                                                                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Payload Trace (Simplificado)</span>
                                                            </div>
                                                            <div className="p-4 overflow-auto max-h-[300px]">
                                                                <pre className="text-xs text-blue-300 font-mono">
                                                                    {JSON.stringify(note, null, 2)}
                                                                </pre>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </DialogContent>
                                            </Dialog>

                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </Card>

                {/* Painel Direito: Certificados */}
                <Card className="bg-card/50 border-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] backdrop-blur-xl overflow-hidden flex flex-col h-fit animate-in fade-in slide-in-from-bottom-6 duration-700 delay-500 fill-mode-both">
                    <div className="p-4 border-b border-white/5 bg-muted/20">
                        <h2 className="font-semibold flex items-center gap-2"><ShieldCheck className="w-4 h-4 opacity-70" /> Cofre de Certificados</h2>
                    </div>
                    <div className="p-0">
                        {isLoadingCerts ? (
                            <div className="p-4 space-y-4">
                                <Skeleton className="h-16 w-full rounded-xl" />
                                <Skeleton className="h-16 w-full rounded-xl" />
                            </div>
                        ) : isErrorCerts ? (
                            <div className="p-8 text-center text-sm text-destructive">Falha ao se conectar com a API.</div>
                        ) : !Array.isArray(certs) || certs.length === 0 ? (
                            <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-3">
                                <ShieldCheck className="w-8 h-8 opacity-20" />
                                <span className="text-sm">Nenhum certificado instalado no disco.</span>
                            </div>
                        ) : (
                            <div className="divide-y divide-white/5">
                                {certs.map((cert) => (
                                    <div key={cert.id} className="p-4 flex flex-col gap-2 hover:bg-muted/30 transition-colors">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-2">
                                                <ShieldCheck className={cert.isLatest ? "w-4 h-4 text-emerald-500" : "w-4 h-4 text-muted-foreground"} />
                                                <span className="text-sm font-medium">{cert.fileName}</span>
                                            </div>
                                            {cert.isLatest && <Badge variant="outline" className="text-[10px] h-5 bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Prioritário</Badge>}
                                        </div>
                                        <div className="flex justify-between items-center text-xs text-muted-foreground mt-1">
                                            <span>Cadastrado em:</span>
                                            <span>{new Date(cert.createdAt).toLocaleDateString('pt-BR')} às {new Date(cert.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
}
