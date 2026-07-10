import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DbModule } from '../db/db.module';
import { StoryModule } from '../story/story.module';
import { NpcService } from './npc.service';
import { NpcController } from './npc.controller';

@Module({
  imports: [DbModule, AuthModule, StoryModule],
  controllers: [NpcController],
  providers: [NpcService],
  exports: [NpcService],
})
export class NpcModule {}
