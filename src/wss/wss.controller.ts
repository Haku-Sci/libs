import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { TicketService } from './ticket.service';
import { WssMicroservice } from './wss-microservice.service';

@Controller('wss')
export class WssController {
  @MessagePattern('get')
  async get(data: Record<string, any>) {
    const { id, properties } = data;
    const ticket = TicketService.create(id, properties);
    return `${WssMicroservice.url}?ticket=${ticket}`;
  }
}
