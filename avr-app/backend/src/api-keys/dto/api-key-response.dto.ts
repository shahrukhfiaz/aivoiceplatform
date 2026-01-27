export class ApiKeyResponseDto {
  id: string;
  name: string;
  keyPrefix: string;
  key: string;
  scopes: string[];
  expiresAt?: string | null;
  lastUsedAt?: string | null;
  createdAt: string;
  isActive: boolean;
}

export class ApiKeyCreatedResponseDto extends ApiKeyResponseDto {}
