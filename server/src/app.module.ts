import { Module } from '@nestjs/common';
import { DbModule } from './db/db.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GameModule } from './game/game.module';

@Module({
  imports: [DbModule, GameModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
