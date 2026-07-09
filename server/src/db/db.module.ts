import { Global, Module } from '@nestjs/common';
import { DbService } from './db.service';
import { PlayerStateRepository } from './player-state.repository';

@Global()
@Module({
  providers: [DbService, PlayerStateRepository],
  exports: [DbService, PlayerStateRepository],
})
export class DbModule {}
