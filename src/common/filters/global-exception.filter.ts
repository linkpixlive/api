import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { DomainError } from '../errors/domain.error';

interface NestErrorResponse {
  message: string | string[];
  error?: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : exception instanceof DomainError
          ? exception.status
          : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : {
            message:
              exception instanceof DomainError
                ? exception.message
                : 'Internal Server Error',
          };

    const errorMessage =
      exception instanceof Error ? exception.message : 'Unhandled exception';
    const errorStack = exception instanceof Error ? exception.stack : undefined;

    if (status >= 500) {
      this.logger.error(errorMessage, errorStack);
    } else {
      this.logger.debug(
        `HTTP ${status} ${exception instanceof Error ? exception.name : typeof exception}`,
      );
    }

    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : (exceptionResponse as NestErrorResponse).message;

    response.status(status).json({
      success: false,
      error: {
        message: Array.isArray(message) ? message[0] : message,
        code: status,
      },
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
