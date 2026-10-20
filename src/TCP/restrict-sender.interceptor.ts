import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ForbiddenException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { RESTRICT_SENDER_KEY } from './restrict-sender.decorator';

type SenderRestriction = string[] | string | undefined;

// A method restriction overrides its class one; '*' lifts the restriction. Without any restriction,
// every sender is allowed.
export function assertSenderAllowed(
  methodRestriction: SenderRestriction,
  classRestriction: SenderRestriction,
  sender: string | undefined,
): void {
  const restriction = methodRestriction ?? classRestriction;
  if (restriction === undefined || restriction === '*') return;
  const allowedSenders = Array.isArray(restriction) ? restriction : [restriction];
  if (!sender || !allowedSenders.includes(sender))
    throw new ForbiddenException(`Sender '${sender}' is not authorized`);
}

@Injectable()
export class RestrictSenderInterceptor implements NestInterceptor {
  constructor(private reflector: Reflector) { }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    assertSenderAllowed(
      this.reflector.get<SenderRestriction>(RESTRICT_SENDER_KEY, context.getHandler()),
      this.reflector.get<SenderRestriction>(RESTRICT_SENDER_KEY, context.getClass()),
      context.switchToRpc().getData()?.sender,
    );
    return next.handle();
  }
}
