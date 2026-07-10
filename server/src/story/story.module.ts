import { Module } from '@nestjs/common';
import { StoryFlagService } from './story-flag.service';

@Module({
  providers: [StoryFlagService],
  exports: [StoryFlagService],
})
export class StoryModule {}
