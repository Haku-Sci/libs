import { Module } from '@nestjs/common';
import { WssController } from './wss.controller';

@Module({
  controllers: [WssController],
})
export class WssModule {}
