import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LlmService } from './llm.service';
import { AgentTraceService } from './agent-trace.service';
import { AgentTraceController } from './agent-trace.controller';

@Module({
  imports: [AuthModule],
  controllers: [AgentTraceController],
  providers: [LlmService, AgentTraceService],
  exports: [LlmService, AgentTraceService],
})
export class AgentModule {}
