const { execSync, spawn } = require('child_process');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

console.log('=======================================================');
console.log('         NFS-E EMISSOR - STARTUP AUTOMATIZADO          ');
console.log('          (Ambiente Hibrido: Local + Docker)           ');
console.log('=======================================================');

// 1. Configurar .env Seguro se nao existir
const envPath = path.join(__dirname, '..', '.env');
const envExamplePath = path.join(__dirname, '..', '.env.example');

if (!fs.existsSync(envPath)) {
    console.log('[OK] Arquivo .env nao encontrado. Gerando um novo sigiloso...');
    let envContent = fs.readFileSync(envExamplePath, 'utf8');

    // Gerar chaves unicas dinamicamente em runtime
    const jwtSecret = crypto.randomBytes(32).toString('hex');
    const certSecret = crypto.randomBytes(16).toString('hex'); // 32 chars

    envContent = envContent.replace('your-super-secret-jwt-key-change-in-production', jwtSecret);
    envContent = envContent.replace('your-aes-256-key-must-be-32-chars!!', certSecret);
    envContent = envContent.replace(/DATABASE_URL=.*/g, 'DATABASE_URL=postgresql://nfse_user:nfse_pass@localhost:5432/nfse_db?schema=public');
    envContent = envContent.replace(/REDIS_HOST=.*/g, 'REDIS_HOST=localhost');
    envContent = envContent.replace(/PREFEITURA_MOCK_URL=.*/g, 'PREFEITURA_MOCK_URL=http://localhost:4000/nfse');

    fs.writeFileSync(envPath, envContent);
    console.log('[OK] Chaves e conexoes locais configuradas no .env (Ocultas)');
} else {
    console.log('[OK] Arquivo .env ja identificado.');
}

// 2. Subir Infraestrutura Docker (Banco, Redis, Mock)
console.log('\n[1/3] Subindo Infraestrutura em Containers (Postgres, Redis, Mock)...');
try {
    execSync('docker compose -f docker-compose.local.yml up -d', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
} catch (e) {
    try {
        // Fallback para versoes antigas do docker-compose
        execSync('docker-compose -f docker-compose.local.yml up -d', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
    } catch (err) {
        console.error('[ERRO] Falha ao subir containers. O Docker esta instalado e rodando?');
        process.exit(1);
    }
}

console.log('\n[Aguardando 5 segundos para o banco mapear as portas...]');
execSync('node -e "setTimeout(()=>{}, 5000)"');

// 3. Preparar banco e seeds via Prisma
console.log('\n[2/3] Preparando Banco de Dados e tabelas pelo Node Local...');
execSync('npx prisma generate', { stdio: 'inherit', cwd: path.join(__dirname, '../apps/api') });
execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit', cwd: path.join(__dirname, '../apps/api') });
execSync('npx prisma db seed', { stdio: 'inherit', cwd: path.join(__dirname, '../apps/api') });

// 4. Iniciar API e Worker
console.log('\n[3/3] Iniciando API e Worker na propria maquina...\n');
console.log('Pressione CTRL+C a qualquer momento para encerrar.\n');

const api = spawn('npm', ['run', 'start:dev', '-w', 'apps/api'], { stdio: 'inherit', shell: true, cwd: path.join(__dirname, '..') });
const worker = spawn('npm', ['run', 'start:dev', '-w', 'apps/worker'], { stdio: 'inherit', shell: true, cwd: path.join(__dirname, '..') });

process.on('SIGINT', () => {
    console.log('\nEncerrando processos locais...');
    api.kill('SIGINT');
    worker.kill('SIGINT');
    process.exit();
});
