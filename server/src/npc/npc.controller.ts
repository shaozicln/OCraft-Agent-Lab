import { Controller, Get, Param } from '@nestjs/common';
import { NpcService } from './npc.service';

@Controller('npc')
export class NpcController {
  constructor(private readonly npcService: NpcService) {}

  @Get(':id')
  getNpc(@Param('id') id: string) {
    return this.npcService.getPublicProfile(id);
  }
}
