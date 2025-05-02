import { Catch, ArgumentsHost, RpcExceptionFilter, Logger, HttpException } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { Observable, throwError } from 'rxjs';

@Catch()
export class AllExceptionsFilter implements RpcExceptionFilter<any> {
  private readonly logger: Logger;

  constructor(identifier: string) {
    this.logger = new Logger(identifier);
    this.logger.log('ExceptionsHandler initialized');
  }

  catch(exception: any, host: ArgumentsHost): Observable<any> {
    this.logger.error('Exception caught in filter:', exception);
    const { message, status, details } = exception instanceof RpcException ? exception.getError() as any : exception

    this.logger.error('Error payload:', message);

    return throwError(() => new HttpException(message, status || 500, { description: details }));
  }
}
