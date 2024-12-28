import { Module } from '@nestjs/common';
import { MicroserviceService } from './microservice.service';
import { ModuleRef } from '@nestjs/core';

@Module({
  providers: [MicroserviceService],
  exports: [MicroserviceService,ModuleRef],
})
export class MicroserviceModule { }