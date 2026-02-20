import { NoteStatus, SaleStatus } from './enums';

// ─── User ──────────────────────────────────────────────────────
export interface IUser {
    id: string;
    username: string;
    password: string;
    createdAt: Date;
    updatedAt: Date;
}

// ─── Certificate ───────────────────────────────────────────────
export interface ICertificate {
    id: string;
    userId: string;
    filePath: string;
    encryptedPassword: string;
    iv: string;
    authTag: string;
    createdAt: Date;
    updatedAt: Date;
}

// ─── Sale ──────────────────────────────────────────────────────
export interface ISale {
    id: string;
    userId: string;
    externalId: string;
    tomakerName: string;
    tomakerDocument: string;
    tomakerEmail: string;
    serviceDescription: string;
    amount: number;
    status: SaleStatus;
    createdAt: Date;
    updatedAt: Date;
}

// ─── NoteEmission ──────────────────────────────────────────────
export interface INoteEmission {
    id: string;
    saleId: string;
    status: NoteStatus;
    protocol: string | null;
    xmlSent: string | null;
    xmlResponse: string | null;
    errorMessage: string | null;
    attempts: number;
    processedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

// ─── Webhook Payload ───────────────────────────────────────────
export interface IWebhookPayload {
    event: 'NOTE_EMITTED' | 'NOTE_FAILED';
    noteId: string;
    saleId: string;
    externalId: string;
    status: NoteStatus;
    protocol: string | null;
    errorMessage: string | null;
    timestamp: string;
}

// ─── Prefeitura Response ───────────────────────────────────────
export interface IPrefeituraResponse {
    success: boolean;
    protocol?: string;
    message?: string;
    xml: string;
}
