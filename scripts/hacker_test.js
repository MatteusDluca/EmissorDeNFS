const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

async function attackSimulation() {
    console.log('[RED TEAM] Iniciando Ataque simulado...\n');
    const API = 'http://localhost:3000';

    try {
        // 1. Criar novo usuário (simulando um tenant cliente da API)
        const username = `empresa_cliente_${Date.now()}`;
        const password = 'minha_senha_forte_123';

        console.log(`[1] Registrando novo usuário via POST /auth/register: ${username}...`);

        // A API original exigiria uma rota de register (se publico). 
        // Como no nosso escopo tínhamos só login com admin seedado, vamos usar o prisma pra injetar o user:
    } catch (e) {
        console.error(e.response ? e.response.data : e.message);
    }
}
attackSimulation();
