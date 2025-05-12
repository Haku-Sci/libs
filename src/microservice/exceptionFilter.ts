import { Catch, ArgumentsHost, Logger, RpcExceptionFilter } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { RpcException } from '@nestjs/microservices';
@Catch(RpcException)
export class AllExceptionsFilter implements RpcExceptionFilter<any> {
  private readonly logger: Logger;
  constructor(logger: Logger) {
    this.logger = logger;
    this.logger.log('ExceptionsHandler initialized');
  }
  handleUnknownError(exception: any, status: string): Observable<never> {
    return this.handleException(exception) as Observable<never>;
  }

  isError(exception: any): exception is Error {
    throw new Error('Method not implemented.');
  }

  catch(exception: any, host: ArgumentsHost): Observable<any> {
    return this.handleException(exception);
  }

  private handleException(exception: any): Observable<any | never> {
    return throwError(() => new RpcException(exception));
  }
}
