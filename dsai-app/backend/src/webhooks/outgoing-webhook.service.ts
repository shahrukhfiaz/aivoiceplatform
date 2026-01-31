import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  OutgoingWebhook,
  WebhookDeliveryLog,
  WebhookEventType,
} from './outgoing-webhook.entity';
import * as crypto from 'crypto';

export interface CreateOutgoingWebhookDto {
  name: string;
  url: string;
  events: WebhookEventType[];
  secret?: string;
  headers?: Record<string, string>;
  maxRetries?: number;
  timeoutMs?: number;
  organizationId?: string;
}

export interface UpdateOutgoingWebhookDto {
  name?: string;
  url?: string;
  events?: WebhookEventType[];
  isActive?: boolean;
  secret?: string;
  headers?: Record<string, string>;
  maxRetries?: number;
  timeoutMs?: number;
}

export interface WebhookPayload {
  event: WebhookEventType;
  timestamp: string;
  data: Record<string, unknown>;
}

@Injectable()
export class OutgoingWebhookService {
  private readonly logger = new Logger(OutgoingWebhookService.name);

  constructor(
    @InjectRepository(OutgoingWebhook)
    private readonly webhookRepo: Repository<OutgoingWebhook>,
    @InjectRepository(WebhookDeliveryLog)
    private readonly logRepo: Repository<WebhookDeliveryLog>,
  ) {}

  // ==================== CRUD Operations ====================

  async create(dto: CreateOutgoingWebhookDto): Promise<OutgoingWebhook> {
    const webhook = this.webhookRepo.create(dto);
    return this.webhookRepo.save(webhook);
  }

  async findAll(organizationId?: string): Promise<OutgoingWebhook[]> {
    const where: Record<string, unknown> = {};
    if (organizationId) where.organizationId = organizationId;
    return this.webhookRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async findById(id: string): Promise<OutgoingWebhook> {
    const webhook = await this.webhookRepo.findOne({ where: { id } });
    if (!webhook) throw new NotFoundException('Webhook not found');
    return webhook;
  }

  async update(id: string, dto: UpdateOutgoingWebhookDto): Promise<OutgoingWebhook> {
    const webhook = await this.findById(id);
    Object.assign(webhook, dto);
    return this.webhookRepo.save(webhook);
  }

  async delete(id: string): Promise<void> {
    const result = await this.webhookRepo.delete(id);
    if (result.affected === 0) throw new NotFoundException('Webhook not found');
  }

  async toggleActive(id: string, isActive: boolean): Promise<OutgoingWebhook> {
    const webhook = await this.findById(id);
    webhook.isActive = isActive;
    return this.webhookRepo.save(webhook);
  }

  // ==================== Event Dispatching ====================

  /**
   * Dispatch an event to all registered webhooks that listen for it
   */
  async dispatch(
    event: WebhookEventType,
    data: Record<string, unknown>,
    organizationId?: string,
  ): Promise<void> {
    // Find all active webhooks that subscribe to this event
    const where: Record<string, unknown> = { isActive: true };
    if (organizationId) where.organizationId = organizationId;

    const webhooks = await this.webhookRepo.find({ where });

    const matchingWebhooks = webhooks.filter((w) =>
      w.events.includes(event),
    );

    if (matchingWebhooks.length === 0) {
      return;
    }

    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data,
    };

    // Dispatch to all matching webhooks in parallel (non-blocking)
    Promise.all(
      matchingWebhooks.map((webhook) =>
        this.deliverWebhook(webhook, payload).catch((err) =>
          this.logger.error(`Failed to deliver webhook ${webhook.id}: ${err.message}`),
        ),
      ),
    ).catch(() => {
      // Ignore - individual errors are already logged
    });
  }

  /**
   * Deliver a webhook with retry logic
   */
  private async deliverWebhook(
    webhook: OutgoingWebhook,
    payload: WebhookPayload,
  ): Promise<void> {
    let lastError: string | undefined;
    let statusCode: number | undefined;
    let responseBody: string | undefined;

    for (let attempt = 1; attempt <= webhook.maxRetries; attempt++) {
      const startTime = Date.now();

      // Create log entry
      const log = await this.logRepo.save(
        this.logRepo.create({
          webhookId: webhook.id,
          event: payload.event,
          status: 'pending',
          payload,
          attemptNumber: attempt,
        }),
      );

      try {
        const body = JSON.stringify(payload);
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'User-Agent': 'DSAI-Webhook/1.0',
          ...webhook.headers,
        };

        // Add HMAC signature if secret is configured
        if (webhook.secret) {
          const signature = this.generateSignature(body, webhook.secret);
          headers['X-Webhook-Signature'] = signature;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), webhook.timeoutMs);

        const response = await fetch(webhook.url, {
          method: 'POST',
          headers,
          body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        statusCode = response.status;
        responseBody = await response.text().catch(() => '');
        const durationMs = Date.now() - startTime;

        if (response.ok) {
          // Success
          await this.logRepo.update(log.id, {
            status: 'delivered',
            statusCode,
            responseBody: responseBody.substring(0, 1000), // Truncate response
            durationMs,
          });

          // Update webhook stats
          await this.webhookRepo.update(webhook.id, {
            totalDelivered: () => 'totalDelivered + 1',
            lastDeliveredAt: new Date(),
          });

          this.logger.debug(`Webhook delivered: ${webhook.name} -> ${payload.event}`);
          return;
        }

        // Non-success status code
        lastError = `HTTP ${statusCode}: ${responseBody.substring(0, 200)}`;
        await this.logRepo.update(log.id, {
          status: 'failed',
          statusCode,
          responseBody: responseBody.substring(0, 1000),
          errorMessage: lastError,
          durationMs,
        });
      } catch (err) {
        const durationMs = Date.now() - startTime;
        lastError = err.name === 'AbortError' ? 'Request timeout' : err.message;

        await this.logRepo.update(log.id, {
          status: 'failed',
          errorMessage: lastError,
          durationMs,
        });
      }

      // Wait before retry (exponential backoff)
      if (attempt < webhook.maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    // All retries failed
    await this.webhookRepo.update(webhook.id, {
      totalFailed: () => 'totalFailed + 1',
      lastFailedAt: new Date(),
      lastError,
    });

    this.logger.warn(`Webhook delivery failed after ${webhook.maxRetries} attempts: ${webhook.name}`);
  }

  /**
   * Generate HMAC-SHA256 signature for webhook payload
   */
  private generateSignature(body: string, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(body);
    return `sha256=${hmac.digest('hex')}`;
  }

  // ==================== Logs ====================

  async getDeliveryLogs(
    webhookId: string,
    limit: number = 50,
  ): Promise<WebhookDeliveryLog[]> {
    return this.logRepo.find({
      where: { webhookId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getRecentLogs(
    organizationId?: string,
    limit: number = 100,
  ): Promise<WebhookDeliveryLog[]> {
    const qb = this.logRepo
      .createQueryBuilder('log')
      .leftJoin(OutgoingWebhook, 'webhook', 'webhook.id = log.webhookId')
      .orderBy('log.createdAt', 'DESC')
      .take(limit);

    if (organizationId) {
      qb.where('webhook.organizationId = :organizationId', { organizationId });
    }

    return qb.getMany();
  }

  // ==================== Test Delivery ====================

  async testWebhook(id: string): Promise<{ success: boolean; message: string }> {
    const webhook = await this.findById(id);

    const testPayload: WebhookPayload = {
      event: 'call.started',
      timestamp: new Date().toISOString(),
      data: {
        test: true,
        message: 'This is a test webhook delivery',
        webhookId: webhook.id,
        webhookName: webhook.name,
      },
    };

    try {
      const body = JSON.stringify(testPayload);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'DSAI-Webhook/1.0',
        'X-Webhook-Test': 'true',
        ...webhook.headers,
      };

      if (webhook.secret) {
        headers['X-Webhook-Signature'] = this.generateSignature(body, webhook.secret);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), webhook.timeoutMs);

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return { success: true, message: `Test delivered successfully (HTTP ${response.status})` };
      }

      return {
        success: false,
        message: `Server returned HTTP ${response.status}: ${await response.text().catch(() => 'No response body')}`,
      };
    } catch (err) {
      return {
        success: false,
        message: err.name === 'AbortError' ? 'Request timed out' : err.message,
      };
    }
  }
}
