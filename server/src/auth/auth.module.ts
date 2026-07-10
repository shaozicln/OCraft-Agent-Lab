import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PlayerController } from './player.controller';

@Module({
  controllers: [AuthController, PlayerController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
