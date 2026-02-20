/**
 * NoteStatus - Status possíveis de uma emissão de NFS-e
 */
export enum NoteStatus {
    PENDING = 'PENDING',
    PROCESSING = 'PROCESSING',
    SUCCESS = 'SUCCESS',
    ERROR = 'ERROR',
}

/**
 * SaleStatus - Status de uma venda
 */
export enum SaleStatus {
    PENDING = 'PENDING',
    PROCESSING = 'PROCESSING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
}
