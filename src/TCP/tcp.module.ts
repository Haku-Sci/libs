import { Module } from '@nestjs/common';
import { TCPService } from './tcp.service';
import { Reflector } from '@nestjs/core';
import { RestrictSenderInterceptor } from './restrict-sender.interceptor';

@Module({
    providers:[TCPService,Reflector, RestrictSenderInterceptor],
    exports:[TCPService]
})
export class TcpModule {}
