// ─── Create Sale DTO ───────────────────────────────────────────
export interface CreateSaleDto {
    externalId: string;
    tomakerName: string;
    tomakerDocument: string;
    tomakerEmail: string;
    serviceDescription: string;
    amount: number;
}

// ─── Sale Response DTO ─────────────────────────────────────────
export interface SaleResponseDto {
    id: string;
    externalId: string;
    status: string;
    message: string;
}

// ─── Login DTO ─────────────────────────────────────────────────
export interface LoginDto {
    username: string;
    password: string;
}

// ─── Auth Response DTO ─────────────────────────────────────────
export interface AuthResponseDto {
    accessToken: string;
    tokenType: string;
    expiresIn: string;
}

// ─── Upload Certificate DTO ────────────────────────────────────
export interface UploadCertificateDto {
    password: string;
}

// ─── Note Response DTO ─────────────────────────────────────────
export interface NoteResponseDto {
    id: string;
    saleId: string;
    externalId: string;
    status: string;
    protocol: string | null;
    errorMessage: string | null;
    attempts: number;
    processedAt: string | null;
    createdAt: string;
}

// ─── Note Job Data ─────────────────────────────────────────────
export interface NoteJobData {
    saleId: string;
    userId: string;
    externalId: string;
}
