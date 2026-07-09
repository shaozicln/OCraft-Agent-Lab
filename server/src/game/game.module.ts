import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DbModule } from '../db/db.module';
import { GameGateway } from './game.gateway';
import { ConversationService } from './conversation.service';
import { ConversationArchiveService } from './conversation-archive.service';
import { AgentHarnessService } from '../agent/agent-harness.service';
import { LlmService } from '../agent/llm.service';
import { RagService } from '../agent/rag.service';
import { NpcModule } from '../npc/npc.module';

@Module({
  imports: [DbModule, AuthModule, NpcModule],
  providers: [
    GameGateway,
    ConversationService,
    ConversationArchiveService,
    RagService,
    LlmService,
    AgentHarnessService,
  ],
})
export class GameModule {}
