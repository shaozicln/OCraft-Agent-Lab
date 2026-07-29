import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AgentModule } from '../agent/agent.module';
import { PackController } from './pack.controller';
import { PackService } from './pack.service';
import { PackGenerateService } from './pack-generate.service';
import { PackClarifyService } from './pack-clarify.service';
import { PackDistillService } from './pack-distill.service';
import { StoryFlagService } from './story-flag.service';
import { WorldProgressService } from './world-progress.service';

@Module({
  imports: [AuthModule, AgentModule],
  controllers: [PackController],
  providers: [
    StoryFlagService,
    WorldProgressService,
    PackService,
    PackGenerateService,
    PackClarifyService,
    PackDistillService,
  ],
  exports: [StoryFlagService, WorldProgressService, PackService],
})
export class StoryModule {}
