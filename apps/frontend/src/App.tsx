import { Toaster } from '@/components/ui/sonner';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AppLayout } from '@/components/layout/AppLayout';
import { Login } from '@/features/auth/pages/Login';

// Criarei mock screens para as demais fases
const Dashboard = () => <div className="p-8">Dashboard em construção (Fase 4)...</div>;
const Sales = () => <div className="p-8">Formulário de Vendas em construção (Fase 4)...</div>;
const Certificates = () => <div className="p-8">Upload de Certificado em construção (Fase 3)...</div>;

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/sales" element={<Sales />} />
            <Route path="/certificates" element={<Certificates />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster theme="dark" position="bottom-right" />
    </QueryClientProvider>
  );
}
