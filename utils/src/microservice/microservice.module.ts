import { Module } from '@nestjs/common';
import { Microservice} from './microservice.service';
import { ModuleRef } from '@nestjs/core';

@Module({
  providers: [Microservice],
  exports: [Microservice,ModuleRef],
})
export class UtilsModule { }