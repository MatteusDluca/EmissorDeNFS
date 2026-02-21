import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import type { NoteResponseDto } from '@nfse/shared';
import { useQuery } from '@tanstack/react-query';
import { Activity, AlertCircle, CheckCircle2, Clock, FileCode2, RefreshCw } from 'lucide-react';

export function Dashboard() {


    const fetchNotes = async (): Promise<NoteResponseDto[]> => {
        const response = await api.get('/notes');
        return response.data;
    };

    const { data: notes, isLoading, isError, refetch } = useQuery({
        queryKey: ['notes'],
        queryFn: fetchNotes,
        // Active Polling requirement: refetch every 3s if ANY note is PROCESSING
        refetchInterval: (query) => {
            const data = query.state?.data;
            if (!data) return false;
            const isProcessing = data.some((note: NoteResponseDto) => note.status === 'PROCESSING' || note.status === 'PENDING');
            return isProcessing ? 3000 : false;
        },
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
        <div className="max-w-6xl mx-auto py-8 space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-semibold tracking-tight">Painel de Notas (Real-time)</h1>
                    <p className="text-muted-foreground mt-1">Acompanhe as emissões de Notas Fiscais operadas pelo Worker em background.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
                    <RefreshCw className="w-4 h-4" /> Atualizar
                </Button>
            </div>

            <Card className="bg-card/40 border-white/5 shadow-xl backdrop-blur-sm overflow-hidden">
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
                        ) : notes?.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center h-48 text-muted-foreground">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <FileCode2 className="w-8 h-8 opacity-20" />
                                        <span>Nenhuma fatura foi processada ainda.</span>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            notes?.map((note) => (
                                <TableRow key={note.id} className="border-white/5 hover:bg-muted/30 transition-colors">
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
                                                    <DialogDescription>
                                                        ID Trace: <code className="text-xs ml-1">{note.id}</code>
                                                    </DialogDescription>
                                                </DialogHeader>

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
        </div>
    );
}
