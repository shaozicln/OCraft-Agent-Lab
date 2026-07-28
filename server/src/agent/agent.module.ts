import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LlmService } from './core/llm.service';
import { AgentTraceService } from './observability/agent-trace.service';
import { AgentTraceController } from './observability/agent-trace.controller';

/** Agent 核心模块：导出 LLM 与 Trace；其余编排服务由 GameModule 挂载 */
@Module({
  imports: [AuthModule],
  controllers: [AgentTraceController],
  providers: [LlmService, AgentTraceService],
  exports: [LlmService, AgentTraceService],
})
export class AgentModule {}
