import { Catch, Logger, RpcExceptionFilter } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { RpcException } from '@nestjs/microservices';
import { RemoteServiceException } from '../TCP/remote-service.exception';
import { toHakuError } from '../TCP/haku-error';
@Catch(RpcException)
export class AllExceptionsFilter implements RpcExceptionFilter<any> {
  private readonly logger: Logger;
  constructor(logger: Logger) {
    this.logger = logger;
    this.logger.log('ExceptionsHandler initialized');
  }
  handleUnknownError(exception: any): Observable<never> {
    return this.handleException(exception) as Observable<never>;
  }

  isError(exception: any): exception is Error {
    return exception instanceof Error;
  }

  catch(exception: any): Observable<any> {
    return this.handleException(exception);
  }

  // Printed locally only; the caller gets the error as a HakuError (with this layer's stack).
  private handleException(exception: any): Observable<any | never> {
    const status = exception?.getStatus?.() ?? exception?.status ?? exception?.statusCode;
    if (exception instanceof RemoteServiceException)
      this.logger.debug(`Relayed from ${exception.getResponse()?.['service']}: ${exception.message}`);
    else if (typeof status === 'number' && status < 500)
      this.logger.warn(exception instanceof Error ? exception : exception?.message ?? exception);
    else if (exception instanceof Error)
      this.logger.error(exception.message, exception.stack);
    else
      this.logger.error(exception);
    return throwError(() => new RpcException(toHakuError(exception)));
  }
}
