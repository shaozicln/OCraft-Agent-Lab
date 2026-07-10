import { Module } from '@nestjs/common';
import { StoryFlagService } from './story-flag.service';
import { PackService } from './pack.service';

@Module({
  providers: [StoryFlagService, PackService],
  exports: [StoryFlagService, PackService],
})
export class StoryModule {}
