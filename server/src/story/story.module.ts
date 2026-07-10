import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PackController } from './pack.controller';
import { PackService } from './pack.service';
import { StoryFlagService } from './story-flag.service';

@Module({
  imports: [AuthModule],
  controllers: [PackController],
  providers: [StoryFlagService, PackService],
  exports: [StoryFlagService, PackService],
})
export class StoryModule {}
