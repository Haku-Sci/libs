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

@Injectable()
export class RestrictSenderInterceptor implements NestInterceptor {
  constructor(private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToRpc();
    const data = ctx.getData();
    const sender = data?.sender;

    const handler = context.getHandler();
    const target = context.getClass();

    const methodRestriction = this.reflector.get<string[] | string | undefined>(
      RESTRICT_SENDER_KEY,
      handler,
    );

    const classRestriction = this.reflector.get<string[] | undefined>(
      RESTRICT_SENDER_KEY,
      target,
    );

    // Cas 1 : méthode annule les restrictions
    if (methodRestriction === '*') {
      return next.handle();
    }

    // Cas 2 : méthode définit ses propres règles (prioritaire)
    const allowedSenders:string[] | string = methodRestriction ?? classRestriction ?? [];

    if (allowedSenders === '*') {
      return next.handle(); // normalement inutile ici, mais sécurité
    }

    if (allowedSenders!==sender && !allowedSenders.includes(sender)) {
      throw new ForbiddenException(`Sender '${sender}' is not authorized`);
    }

    return next.handle();
  }
}
