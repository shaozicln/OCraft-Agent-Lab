import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { DbModule } from './db/db.module';
import { GameModule } from './game/game.module';

@Module({
  imports: [DbModule, AuthModule, GameModule],
})
export class AppModule {}
