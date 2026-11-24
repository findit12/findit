import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

interface HttpResponse {
  status(code: number): this;
  json(body: unknown): this | void;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<HttpResponse>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error.';
    let extra: Record<string, unknown> = {};

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the Nest response object has no fixed shape
        const obj = res as Record<string, any>;
        const { statusCode, message: msg, error: err, ...rest } = obj;
        extra = rest;

        if (Array.isArray(msg)) {
          message = msg[0];
        } else if (typeof msg === 'string') {
          message = msg;
        } else if (
          typeof err === 'string' &&
          err !== 'Bad Request' &&
          err !== 'Unauthorized' &&
          err !== 'Not Found' &&
          err !== 'Forbidden' &&
          err !== 'Conflict'
        ) {
          message = err;
        } else if (typeof obj.error === 'string') {
          message = obj.error;
        }
      }
    } else if (exception instanceof Error) {
      this.logger.error('Unhandled exception', exception.stack);
      message = exception.message;
    }

    response.status(status).json({
      error: message,
      ...extra,
    });
  }
}
