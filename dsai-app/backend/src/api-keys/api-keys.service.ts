import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import { ApiKey } from './api-key.entity';
import { User } from '../users/user.entity';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import {
  ApiKeyResponseDto,
  ApiKeyCreatedResponseDto,
} from './dto/api-key-response.dto';

@Injectable()
export class ApiKeysService {
  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepository: Repository<ApiKey>,
  ) {}

  private generateKey(): { key: string; hash: string; prefix: string } {
    const rawKey = randomBytes(32).toString('base64url');
    const key = `sk_live_${rawKey}`;
    const hash = createHash('sha256').update(key).digest('hex');
    const prefix = key.substring(0, 11);
    return { key, hash, prefix };
  }

  private hashKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }

  async create(
    userId: string,
    dto: CreateApiKeyDto,
  ): Promise<ApiKeyCreatedResponseDto> {
    const { key, hash, prefix } = this.generateKey();

    const apiKey = this.apiKeyRepository.create({
      name: dto.name,
      keyHash: hash,
      keyValue: key,
      keyPrefix: prefix,
      userId,
      scopes: dto.scopes || ['read', 'write'],
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
    });

    const saved = await this.apiKeyRepository.save(apiKey);

    return {
      id: saved.id,
      name: saved.name,
      keyPrefix: saved.keyPrefix,
      key,
      scopes: saved.scopes,
      expiresAt: saved.expiresAt?.toISOString() || null,
      lastUsedAt: null,
      createdAt: saved.createdAt.toISOString(),
      isActive: saved.isActive,
    };
  }

  async findAllByUser(userId: string): Promise<ApiKeyResponseDto[]> {
    const keys = await this.apiKeyRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    return keys.map((k) => ({
      id: k.id,
      name: k.name,
      keyPrefix: k.keyPrefix,
      key: k.keyValue,
      scopes: k.scopes,
      expiresAt: k.expiresAt?.toISOString() || null,
      lastUsedAt: k.lastUsedAt?.toISOString() || null,
      createdAt: k.createdAt.toISOString(),
      isActive: k.isActive,
    }));
  }

  async validateKey(
    key: string,
  ): Promise<{ apiKey: ApiKey; user: User } | null> {
    const hash = this.hashKey(key);
    const apiKey = await this.apiKeyRepository.findOne({
      where: { keyHash: hash, isActive: true },
      relations: ['user'],
    });

    if (!apiKey) return null;
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;

    apiKey.lastUsedAt = new Date();
    await this.apiKeyRepository.save(apiKey);

    return { apiKey, user: apiKey.user };
  }

  async revoke(id: string, userId: string): Promise<void> {
    const apiKey = await this.apiKeyRepository.findOne({
      where: { id, userId },
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    apiKey.isActive = false;
    await this.apiKeyRepository.save(apiKey);
  }

  async delete(id: string, userId: string): Promise<void> {
    const result = await this.apiKeyRepository.delete({ id, userId });
    if (result.affected === 0) {
      throw new NotFoundException('API key not found');
    }
  }
}
