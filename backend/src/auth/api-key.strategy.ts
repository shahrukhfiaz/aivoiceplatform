import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { Request } from 'express';
import { ApiKeysService } from '../api-keys/api-keys.service';

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(Strategy, 'api-key') {
  constructor(private readonly apiKeysService: ApiKeysService) {
    super();
  }

  async validate(req: Request): Promise<any> {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer sk_')) {
      throw new UnauthorizedException('Invalid API key format');
    }

    const key = authHeader.substring(7);
    const result = await this.apiKeysService.validateKey(key);

    if (!result) {
      throw new UnauthorizedException('Invalid or expired API key');
    }

    return {
      sub: result.user.id,
      username: result.user.username,
      role: result.user.role,
      apiKeyId: result.apiKey.id,
      apiKeyScopes: result.apiKey.scopes,
    };
  }
}
