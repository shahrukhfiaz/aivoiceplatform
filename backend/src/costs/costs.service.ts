import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class CostsService {
  private readonly logger = new Logger(CostsService.name);

  // Deepgram Voice Agent rate: $4.50/hour = $0.075/minute = $0.00125/second
  private readonly VOICE_AGENT_RATE_PER_SECOND = 0.00125;

  /**
   * Calculate cost from call duration (immediate estimate)
   * Uses Deepgram Voice Agent pricing: $4.50/hour
   */
  calculateCostFromDuration(startedAt: Date, endedAt: Date): number {
    const durationMs = endedAt.getTime() - startedAt.getTime();
    const durationSeconds = durationMs / 1000;

    if (durationSeconds <= 0) {
      return 0;
    }

    // Calculate cost and round to 4 decimal places
    const cost = durationSeconds * this.VOICE_AGENT_RATE_PER_SECOND;
    return Math.round(cost * 10000) / 10000;
  }

  /**
   * Fetch actual cost from Deepgram Management API
   * Returns null if unable to fetch (API error, missing credentials, etc.)
   */
  async fetchCostFromDeepgram(
    apiKey: string,
    projectId: string,
    startTime: Date,
    endTime: Date,
  ): Promise<number | null> {
    try {
      // Add buffer time around the call to ensure we capture the request
      const bufferMs = 60000; // 1 minute buffer
      const startWithBuffer = new Date(startTime.getTime() - bufferMs);
      const endWithBuffer = new Date(endTime.getTime() + bufferMs);

      // List requests within the call timeframe
      const listUrl = `https://api.deepgram.com/v1/projects/${projectId}/requests`;
      const params = new URLSearchParams({
        start: startWithBuffer.toISOString(),
        end: endWithBuffer.toISOString(),
      });

      this.logger.debug(
        `Fetching Deepgram requests: ${listUrl}?${params.toString()}`,
      );

      const listResponse = await fetch(`${listUrl}?${params}`, {
        headers: {
          Authorization: `Token ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!listResponse.ok) {
        this.logger.warn(
          `Deepgram API returned ${listResponse.status}: ${listResponse.statusText}`,
        );
        return null;
      }

      const listData = (await listResponse.json()) as {
        requests?: Array<{
          request_id: string;
          created?: string;
          path?: string;
        }>;
      };

      if (!listData.requests || listData.requests.length === 0) {
        this.logger.debug('No Deepgram requests found in timeframe');
        return null;
      }

      // Filter for agent/voice requests
      const agentRequests = listData.requests.filter(
        (req) => req.path?.includes('agent') || req.path?.includes('voice'),
      );

      if (agentRequests.length === 0) {
        this.logger.debug('No agent/voice requests found');
        return null;
      }

      // Sum up costs from all matching requests
      let totalCost = 0;

      for (const request of agentRequests) {
        const requestUrl = `https://api.deepgram.com/v1/projects/${projectId}/requests/${request.request_id}`;

        try {
          const reqResponse = await fetch(requestUrl, {
            headers: {
              Authorization: `Token ${apiKey}`,
              'Content-Type': 'application/json',
            },
          });

          if (reqResponse.ok) {
            const reqData = (await reqResponse.json()) as {
              response?: {
                details?: {
                  usd?: number;
                };
              };
            };

            const cost = reqData.response?.details?.usd;
            if (typeof cost === 'number' && cost > 0) {
              totalCost += cost;
            }
          }
        } catch (err) {
          this.logger.debug(
            `Failed to fetch request ${request.request_id}: ${err}`,
          );
        }
      }

      return totalCost > 0 ? Math.round(totalCost * 10000) / 10000 : null;
    } catch (error) {
      this.logger.error(`Failed to fetch Deepgram cost: ${error}`);
      return null;
    }
  }
}
