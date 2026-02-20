import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
    private readonly logger = new Logger('HTTP');

    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        const request = context.switchToHttp().getRequest<Request>();
        const response = context.switchToHttp().getResponse<Response>();

        // Usa o correlation-id do header (nginx) ou gera um novo
        const correlationId =
            (request.headers['x-correlation-id'] as string) || uuidv4();

        request.headers['x-correlation-id'] = correlationId;
        response.setHeader('X-Correlation-ID', correlationId);

        const { method, url } = request;
        const startTime = Date.now();

        return next.handle().pipe(
            tap({
                next: () => {
                    const duration = Date.now() - startTime;
                    this.logger.log(
                        `[${correlationId}] ${method} ${url} → ${response.statusCode} (${duration}ms)`,
                    );
                },
                error: () => {
                    const duration = Date.now() - startTime;
                    this.logger.warn(
                        `[${correlationId}] ${method} ${url} → ERROR (${duration}ms)`,
                    );
                },
            }),
        );
    }
}
