import { decrypt, deriveKey, encrypt } from '../src/crypto';

describe('Crypto Utils', () => {
    const secret = 'my-super-secret-key-for-testing-123';

    describe('encrypt / decrypt', () => {
        it('deve criptografar e descriptografar corretamente', () => {
            const plaintext = 'senha_do_certificado_123';

            const encrypted = encrypt(plaintext, secret);

            expect(encrypted).toHaveProperty('encrypted');
            expect(encrypted).toHaveProperty('iv');
            expect(encrypted).toHaveProperty('authTag');
            expect(encrypted.encrypted).not.toBe(plaintext);

            const decrypted = decrypt(
                encrypted.encrypted,
                encrypted.iv,
                encrypted.authTag,
                secret,
            );

            expect(decrypted).toBe(plaintext);
        });

        it('deve gerar IVs diferentes para mesma entrada', () => {
            const plaintext = 'mesma_senha';

            const result1 = encrypt(plaintext, secret);
            const result2 = encrypt(plaintext, secret);

            // IVs devem ser diferentes (aleatórios)
            expect(result1.iv).not.toBe(result2.iv);
            // Textos criptografados devem ser diferentes
            expect(result1.encrypted).not.toBe(result2.encrypted);
        });

        it('deve falhar ao descriptografar com secret errado', () => {
            const plaintext = 'senha_secreta';
            const encrypted = encrypt(plaintext, secret);

            expect(() => {
                decrypt(
                    encrypted.encrypted,
                    encrypted.iv,
                    encrypted.authTag,
                    'wrong-secret-key-here-testing-12345',
                );
            }).toThrow();
        });

        it('deve falhar ao descriptografar com authTag adulterado', () => {
            const plaintext = 'senha_secreta';
            const encrypted = encrypt(plaintext, secret);

            expect(() => {
                decrypt(
                    encrypted.encrypted,
                    encrypted.iv,
                    'tampered_auth_tag',
                    secret,
                );
            }).toThrow();
        });

        it('deve lidar com strings vazias', () => {
            const plaintext = '';
            const encrypted = encrypt(plaintext, secret);
            const decrypted = decrypt(
                encrypted.encrypted,
                encrypted.iv,
                encrypted.authTag,
                secret,
            );
            expect(decrypted).toBe('');
        });

        it('deve lidar com caracteres especiais', () => {
            const plaintext = 'sénhã@#$%*()_+çáéíóú ñ';
            const encrypted = encrypt(plaintext, secret);
            const decrypted = decrypt(
                encrypted.encrypted,
                encrypted.iv,
                encrypted.authTag,
                secret,
            );
            expect(decrypted).toBe(plaintext);
        });
    });

    describe('deriveKey', () => {
        it('deve derivar chave de 32 bytes', () => {
            const key = deriveKey(secret);
            expect(Buffer.from(key, 'hex').length).toBe(32);
        });

        it('deve gerar mesma chave para mesmo secret', () => {
            const key1 = deriveKey(secret);
            const key2 = deriveKey(secret);
            expect(key1).toBe(key2);
        });

        it('deve gerar chaves diferentes para secrets diferentes', () => {
            const key1 = deriveKey('secret-1');
            const key2 = deriveKey('secret-2');
            expect(key1).not.toBe(key2);
        });
    });
});
