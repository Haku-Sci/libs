import { Module } from '@nestjs/common';
import { RabbitMqService } from './rabbit-mq.service';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';

@Module({
    imports:[RabbitMQModule.forRoot({
        uri: process.env.RABBITMQ_URL,
      })],
    providers:[RabbitMqService],
    exports:[RabbitMqService]
})
export class RabbitMqModule {}
