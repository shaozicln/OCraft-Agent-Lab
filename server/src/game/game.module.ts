import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DbModule } from '../db/db.module';
import { GameGateway } from './game.gateway';
import { ConversationService } from './conversation.service';
import { ConversationArchiveService } from './conversation-archive.service';
import { AgentHarnessService } from '../agent/agent-harness.service';
import { NpcExchangeService } from '../agent/npc-exchange.service';
import { NpcAsideService } from '../agent/npc-aside.service';
import { DirectorService } from '../agent/director.service';
import { AutoPlayAgentService } from '../agent/autoplay-agent.service';
import { LabPeerService } from '../agent/lab-peer.service';
import { AgentModule } from '../agent/agent.module';
import { RagService } from '../agent/rag.service';
import { NpcModule } from '../npc/npc.module';
import { StoryModule } from '../story/story.module';

@Module({
  imports: [DbModule, AuthModule, NpcModule, StoryModule, AgentModule],
  providers: [
    GameGateway,
    ConversationService,
    ConversationArchiveService,
    RagService,
    AgentHarnessService,
    NpcExchangeService,
    NpcAsideService,
    DirectorService,
    AutoPlayAgentService,
    LabPeerService,
  ],
})
export class GameModule {}
