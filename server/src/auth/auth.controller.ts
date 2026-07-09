import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import {
  authSessionSchema,
  formatAuthValidationError,
  loginPayloadSchema,
  registerPayloadSchema,
} from '@ocraft/shared';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() body: unknown) {
    const parsed = registerPayloadSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(formatAuthValidationError(parsed.error));
    }

    const session = await this.authService.register(
      parsed.data.username,
      parsed.data.password,
    );
    return authSessionSchema.parse(session);
  }

  @Post('login')
  async login(@Body() body: unknown) {
    const parsed = loginPayloadSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(formatAuthValidationError(parsed.error));
    }

    const session = await this.authService.login(
      parsed.data.username,
      parsed.data.password,
    );
    return authSessionSchema.parse(session);
  }

  @Get('me')
  async me(@Headers('authorization') authorization?: string) {
    const token = authorization?.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      throw new UnauthorizedException('Missing token');
    }

    const session = await this.authService.resolveSession(token);
    if (!session) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    return authSessionSchema.parse(session);
  }
}
