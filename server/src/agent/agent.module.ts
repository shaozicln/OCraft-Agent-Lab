import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LlmService } from './core/llm.service';
import { LlmSettingsService } from './core/llm-settings.service';
import { AgentTraceService } from './observability/agent-trace.service';
import { AgentTraceController } from './observability/agent-trace.controller';
import { LlmSettingsController } from './llm-settings.controller';

/** Agent 核心模块：导出 LLM 与 Trace；其余编排服务由 GameModule 挂载 */
@Module({
  imports: [AuthModule],
  controllers: [AgentTraceController, LlmSettingsController],
  providers: [LlmService, LlmSettingsService, AgentTraceService],
  exports: [LlmService, LlmSettingsService, AgentTraceService],
})
export class AgentModule {}
