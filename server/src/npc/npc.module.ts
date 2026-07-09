import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { NpcService } from './npc.service';
import { NpcController } from './npc.controller';

@Module({
  imports: [DbModule],
  controllers: [NpcController],
  providers: [NpcService],
  exports: [NpcService],
})
export class NpcModule {}
