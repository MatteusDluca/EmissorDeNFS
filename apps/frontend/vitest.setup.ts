import '@testing-library/jest-dom';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

export const handlers = [
    http.post('/api/auth/login', () => {
        return HttpResponse.json({ accessToken: 'fake-token' })
    }),
    http.get('/api/notes/kpi', () => {
        return HttpResponse.json({ totalAmount: 15000, totalSuccess: 1, totalFailed: 0, totalProcessing: 1 })
    }),
    http.get('/api/notes', () => {
        return HttpResponse.json({
            total: 2,
            notes: [
                { id: '1', externalId: 'venda-teste', status: 'SUCCESS', protocol: '123' },
                { id: '2', externalId: 'venda-teste-2', status: 'PROCESSING' }
            ]
        })
    }),
    http.post('/api/certificates/upload', () => {
        return HttpResponse.json({ success: true })
    })
];

export const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Mock window.matchMedia and ResizeObserver for Shadcn
window.matchMedia = window.matchMedia || function () {
    return {
        matches: false,
        addListener: function () { },
        removeListener: function () { }
    };
};

global.ResizeObserver = class ResizeObserver {
    observe() { }
    unobserve() { }
    disconnect() { }
};
