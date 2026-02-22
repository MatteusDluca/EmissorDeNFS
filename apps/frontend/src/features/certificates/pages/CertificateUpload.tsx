import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { FileLock, KeyRound, UploadCloud } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

const certificateSchema = z.object({
    password: z.string().min(1, 'A senha do certificado é obrigatória'),
});

type CertificateFormValues = z.infer<typeof certificateSchema>;

export function Certificates() {
    const [file, setFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const { register, handleSubmit, reset, formState: { errors } } = useForm<CertificateFormValues>({
        resolver: zodResolver(certificateSchema),
    });

    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const onDragLeave = () => setIsDragging(false);

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const droppedFile = e.dataTransfer.files[0];
            if (droppedFile.name.endsWith('.pfx')) {
                setFile(droppedFile);
            } else {
                toast.error('Formato inválido', { description: 'Apenas arquivos .pfx são aceitos.' });
            }
        }
    };

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const onSubmit = async (data: CertificateFormValues) => {
        if (!file) {
            toast.error('Arquivo ausente', { description: 'Por favor, selecione um certificado .pfx primeiro.' });
            return;
        }

        try {
            setIsLoading(true);
            const formData = new FormData();
            formData.append('file', file);
            formData.append('password', data.password);

            await api.post('/certificates/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            toast.success('Certificado salvo com sucesso!', {
                description: 'Sua assinatura digital está agora protegida e pronta para uso.'
            });

            setFile(null);
            reset();
        } catch (error: any) {
            toast.error('Falha no upload', {
                description: error.response?.data?.message || 'Ocorreu um erro ao enviar o certificado.'
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-semibold tracking-tight">Certificado Digital</h1>
                <p className="text-muted-foreground mt-2">Faça o upload do seu certificado A1 (.pfx) e protegemos a senha em trânsito e em repouso com algoritmo padrão militar.</p>
            </div>

            <Card className="bg-card/40 border-white/5 shadow-xl backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2">
                        <FileLock className="w-5 h-5 text-primary" />
                        Cofre de Assinatura
                    </CardTitle>
                    <CardDescription>
                        Os certificados são armazenados nativamente num cofre offline e criptografados em via tripla GCM.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        <fieldset disabled={isLoading} className="space-y-6 group disabled:opacity-80 transition-opacity">
                            {/* Drag & Drop Area */}
                            <div className="space-y-2">
                                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider group-disabled:opacity-70">Arquivo do Certificado (.pfx)</Label>
                                <div
                                    onDragOver={onDragOver}
                                    onDragLeave={onDragLeave}
                                    onDrop={onDrop}
                                    className={`relative flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg transition-colors
                      ${isDragging ? 'border-primary bg-primary/5' : 'border-border/50 bg-background/50 hover:bg-background/80'}
                      ${file ? 'border-primary/50 bg-primary/5' : ''}
                      group-disabled:pointer-events-none
                    `}
                                >
                                    <input
                                        type="file"
                                        accept=".pfx"
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                                        onChange={onFileChange}
                                        disabled={isLoading}
                                    />
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center pointer-events-none">
                                        {file ? (
                                            <>
                                                <FileLock className="w-10 h-10 text-primary mb-3" />
                                                <p className="mb-2 text-sm font-medium text-foreground">{file.name}</p>
                                                <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(2)} KB • Clique para trocar</p>
                                            </>
                                        ) : (
                                            <>
                                                <UploadCloud className="w-10 h-10 text-muted-foreground mb-3" />
                                                <p className="mb-2 text-sm text-foreground"><span className="font-semibold">Clique para fazer upload</span> ou arraste o arquivo</p>
                                                <p className="text-xs text-muted-foreground">Apenas arquivos .pfx (PKCS #12)</p>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Password Field */}
                            <div className="space-y-2">
                                <Label htmlFor="certPassword" className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2 group-disabled:opacity-70">
                                    <KeyRound className="w-3 h-3" />
                                    Senha de Instalação (Será criptografada AES-256)
                                </Label>
                                <Input
                                    id="certPassword"
                                    type="password"
                                    placeholder="Insira a senha do certificado..."
                                    className="bg-background/50 border-white/10 h-12"
                                    {...register('password')}
                                />
                                {errors.password && (
                                    <p className="text-xs text-destructive">{errors.password.message}</p>
                                )}
                            </div>

                            <Button
                                type="submit"
                                className="w-full h-12 font-medium"
                                disabled={!file}
                                isLoading={isLoading}
                            >
                                Guardar no Cofre Seguro
                            </Button>
                        </fieldset>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
