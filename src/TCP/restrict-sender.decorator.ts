import { SetMetadata, UseInterceptors, applyDecorators } from '@nestjs/common';
import { RestrictSenderInterceptor } from './restrict-sender.interceptor';

export const RESTRICT_SENDER_KEY = 'restrict_sender';

export function RestrictSender(allowedSenders: string[] | string) {
  return applyDecorators(
    SetMetadata(RESTRICT_SENDER_KEY, allowedSenders),
    UseInterceptors(RestrictSenderInterceptor),
  );
}
