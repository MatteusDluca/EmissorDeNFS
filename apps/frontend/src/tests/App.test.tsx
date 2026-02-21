import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test } from 'vitest';
import App from '../App';
import { useAuthStore } from '../stores/authStore';

describe('Frontend Integration Tests', () => {
    beforeEach(() => {
        // Clear auth state before each test
        useAuthStore.getState().logout();
        window.history.pushState({}, 'Login', '/login');
    });

    // Test 1: Renderização do Login
    test('Should render login page correctly', () => {
        render(<App />);
        expect(screen.getByText('NFS-e Emissor')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('admin')).toBeInTheDocument();
    });

    // Test 2: Login com erro de validação
    test('Should show validation errors on empty login submit', async () => {
        render(<App />);
        const submitBtn = screen.getByRole('button', { name: /Acessar Plataforma/i });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(screen.getByText('Usuário é obrigatório')).toBeInTheDocument();
            expect(screen.getByText('Senha é obrigatória')).toBeInTheDocument();
        });
    });

    // Test 3: Login Sucesso redireciona para Dashboard e renderiza as rotas protegidas
    test('Should login and navigate to dashboard', async () => {
        render(<App />);

        fireEvent.change(screen.getByPlaceholderText('admin'), { target: { value: 'admin' } });
        fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'password' } });

        const submitBtn = screen.getByRole('button', { name: /Acessar Plataforma/i });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            // Mocked /notes API should return "Painel de Notas", verifying Dashboard loaded
            expect(screen.getByText('Painel de Notas (Real-time)')).toBeInTheDocument();
        });
    });

    // Test 4: Dashboard Renderiza Tabela com MSW data
    test('Should render notes table with data from API', async () => {
        // Força autenticação
        useAuthStore.getState().login('fake-token');
        window.history.pushState({}, 'Dashboard', '/dashboard');
        render(<App />);

        expect(screen.getByText('Painel de Notas (Real-time)')).toBeInTheDocument();

        // Aguarda o Tanstack Query processar a API Mock do MSW
        await waitFor(() => {
            expect(screen.getByText('venda-teste')).toBeInTheDocument();
            expect(screen.getByText('venda-teste-2')).toBeInTheDocument();
        });
    });

    // Test 5: Dashboard mostra Badge de PROCESSING
    test('Should render Processing badge on processing note', async () => {
        useAuthStore.getState().login('fake-token');
        window.history.pushState({}, 'Dashboard', '/dashboard');
        render(<App />);

        await waitFor(() => {
            expect(screen.getByText('Processando')).toBeInTheDocument();
            expect(screen.getByText('Emitida')).toBeInTheDocument();
        });
    });

    // Test 6: Rota de Upload de Certificado renderiza formulário Drag Drop
    test('Should render Certificate page', async () => {
        useAuthStore.getState().login('fake-token');
        window.history.pushState({}, 'Certificates', '/certificates');
        render(<App />);

        await waitFor(() => {
            expect(screen.getByText('Cofre de Assinatura')).toBeInTheDocument();
            expect(screen.getByText(/Apenas arquivos .pfx/i)).toBeInTheDocument();
        });
    });

    // Test 7: Rota de Sales renderiza formulário
    test('Should render Sales Create page', async () => {
        useAuthStore.getState().login('fake-token');
        window.history.pushState({}, 'Sales', '/sales');
        render(<App />);

        await waitFor(() => {
            expect(screen.getByText('Dados da Prestação de Serviço')).toBeInTheDocument();
            expect(screen.getByText('Valor do Serviço (R$)')).toBeInTheDocument();
        });
    });

    // Test 8: Logout redireciona para o login
    test('Should logout and return to login screen', async () => {
        useAuthStore.getState().login('fake-token');
        window.history.pushState({}, 'Dashboard', '/dashboard');
        render(<App />);

        await waitFor(() => {
            expect(screen.getByText('Sair')).toBeInTheDocument();
        });

        const logoutBtn = screen.getByText('Sair');
        fireEvent.click(logoutBtn);

        await waitFor(() => {
            expect(screen.getByText('Insira suas credenciais para acessar o painel')).toBeInTheDocument();
        });
    });
});
