import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, In, Not } from 'typeorm';
import { Lead } from '../leads/lead.entity';
import { Campaign, CallingHours } from '../campaigns/campaign.entity';
import { CampaignList } from '../campaigns/campaign-list.entity';
import { Agent, AgentStatus } from '../agents/agent.entity';
import { AgentsService } from '../agents/agents.service';
import { CampaignsService } from '../campaigns/campaigns.service';
import { CallUpdatesGateway } from '../webhooks/call-updates.gateway';
import { DncService } from '../dnc/dnc.service';
import { CallerIdService } from '../caller-id/caller-id.service';
import {
  getStateCallingRules,
  inferTimezoneFromState,
  isWithinStateCallingHours,
} from './state-calling-rules';

export interface DialerStats {
  campaignId: string;
  campaignName: string;
  status: string;
  activeLeads: number;
  callsInProgress: number;
  completedToday: number;
  abandonRate: number;
  avgTalkTime: number;
}

interface ActiveCampaign {
  campaign: Campaign;
  intervalId: NodeJS.Timeout;
  callsInProgress: number;
  callsCompleted: number;
  callsAbandoned: number;
  startedAt: Date;
}

@Injectable()
export class DialerService {
  private readonly logger = new Logger(DialerService.name);
  private activeCampaigns: Map<string, ActiveCampaign> = new Map();

  constructor(
    @InjectRepository(Campaign)
    private readonly campaignsRepository: Repository<Campaign>,
    @InjectRepository(Lead)
    private readonly leadsRepository: Repository<Lead>,
    @InjectRepository(CampaignList)
    private readonly listsRepository: Repository<CampaignList>,
    @InjectRepository(Agent)
    private readonly agentsRepository: Repository<Agent>,
    private readonly agentsService: AgentsService,
    private readonly campaignsService: CampaignsService,
    private readonly callUpdatesGateway: CallUpdatesGateway,
    private readonly dncService: DncService,
    private readonly callerIdService: CallerIdService,
  ) {}

  async startCampaign(campaignId: string): Promise<void> {
    if (this.activeCampaigns.has(campaignId)) {
      throw new BadRequestException('Campaign is already running');
    }

    const campaign = await this.campaignsRepository.findOne({
      where: { id: campaignId },
      relations: ['aiAgent', 'outboundTrunk'],
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (!campaign.aiAgent) {
      throw new BadRequestException('Campaign must have an AI agent assigned');
    }

    if (!campaign.outboundTrunk) {
      throw new BadRequestException('Campaign must have an outbound trunk assigned');
    }

    // Check if agent is running
    if (campaign.aiAgent.status !== AgentStatus.RUNNING) {
      throw new BadRequestException('AI Agent must be running to start the campaign');
    }

    // Update campaign status
    await this.campaignsRepository.update(campaignId, { status: 'active' });

    // Start dialing loop
    const intervalId = setInterval(() => {
      this.dialingLoop(campaignId).catch((err) => {
        this.logger.error(`Dialing loop error for campaign ${campaignId}:`, err);
      });
    }, 5000); // Check every 5 seconds

    this.activeCampaigns.set(campaignId, {
      campaign,
      intervalId,
      callsInProgress: 0,
      callsCompleted: 0,
      callsAbandoned: 0,
      startedAt: new Date(),
    });

    this.logger.log(`Campaign ${campaign.name} started`);
    this.callUpdatesGateway.notifyDataChanged('campaign', 'started', campaignId);
  }

  async stopCampaign(campaignId: string): Promise<void> {
    const active = this.activeCampaigns.get(campaignId);
    if (!active) {
      // Just update status if not actively running
      await this.campaignsRepository.update(campaignId, { status: 'paused' });
      return;
    }

    clearInterval(active.intervalId);
    this.activeCampaigns.delete(campaignId);

    await this.campaignsRepository.update(campaignId, { status: 'paused' });

    this.logger.log(`Campaign ${active.campaign.name} stopped`);
    this.callUpdatesGateway.notifyDataChanged('campaign', 'stopped', campaignId);
  }

  async getStats(campaignId: string): Promise<DialerStats> {
    const campaign = await this.campaignsRepository.findOne({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const active = this.activeCampaigns.get(campaignId);
    const stats = await this.campaignsService.getStats(campaignId);

    const totalCalls = active ? active.callsCompleted + active.callsAbandoned : 0;
    const abandonRate = totalCalls > 0
      ? (active!.callsAbandoned / totalCalls) * 100
      : 0;

    return {
      campaignId,
      campaignName: campaign.name,
      status: campaign.status,
      activeLeads: stats.newLeads + stats.callbackLeads,
      callsInProgress: active?.callsInProgress || 0,
      completedToday: active?.callsCompleted || 0,
      abandonRate: Math.round(abandonRate * 100) / 100,
      avgTalkTime: 0, // TODO: Calculate from call records
    };
  }

  async getAllActiveStats(): Promise<DialerStats[]> {
    const stats: DialerStats[] = [];

    for (const [campaignId] of this.activeCampaigns) {
      try {
        const stat = await this.getStats(campaignId);
        stats.push(stat);
      } catch {
        // Campaign may have been deleted
        this.activeCampaigns.delete(campaignId);
      }
    }

    return stats;
  }

  private async dialingLoop(campaignId: string): Promise<void> {
    const active = this.activeCampaigns.get(campaignId);
    if (!active) return;

    const campaign = await this.campaignsRepository.findOne({
      where: { id: campaignId },
      relations: ['aiAgent', 'outboundTrunk'],
    });

    if (!campaign || campaign.status !== 'active') {
      await this.stopCampaign(campaignId);
      return;
    }

    // Check agent is still running
    if (!campaign.aiAgent || campaign.aiAgent.status !== AgentStatus.RUNNING) {
      this.logger.warn(`Agent not running for campaign ${campaign.name}, pausing`);
      await this.stopCampaign(campaignId);
      return;
    }

    // Calculate how many calls to make
    const targetCalls = Math.floor(campaign.callsPerAgent);
    const availableSlots = targetCalls - active.callsInProgress;

    if (availableSlots <= 0) {
      return; // Already at capacity
    }

    // Get next leads to dial
    const leads = await this.getNextLeads(campaignId, availableSlots);

    for (const lead of leads) {
      try {
        await this.dialLead(campaign, lead);
        active.callsInProgress++;
      } catch (err) {
        this.logger.error(`Failed to dial lead ${lead.id}:`, err);
      }
    }
  }

  private async getNextLeads(campaignId: string, limit: number): Promise<Lead[]> {
    // Get campaign to check calling hours settings
    const campaign = await this.campaignsRepository.findOne({
      where: { id: campaignId },
    });

    if (!campaign) {
      return [];
    }

    // Get all lists for this campaign
    const lists = await this.listsRepository.find({
      where: { campaignId, status: 'active' },
    });

    if (lists.length === 0) {
      return [];
    }

    const listIds = lists.map((l) => l.id);
    const now = new Date();

    // Priority order:
    // 1. Callbacks that are due
    // 2. High priority leads
    // 3. New leads

    // Get more leads than requested to account for DNC/time filtering
    const fetchLimit = limit * 5;

    const potentialLeads = await this.leadsRepository.find({
      where: [
        // Callbacks due
        {
          listId: In(listIds),
          status: 'callback',
          nextDialAt: LessThanOrEqual(now),
        },
        // New leads ready for dialing
        {
          listId: In(listIds),
          status: 'new',
        },
      ],
      order: {
        priority: 'DESC',
        createdAt: 'ASC',
      },
      take: fetchLimit,
    });

    // Filter out DNC numbers and leads outside calling hours
    const cleanLeads: Lead[] = [];
    for (const lead of potentialLeads) {
      if (cleanLeads.length >= limit) break;

      // Check DNC
      const isBlocked = await this.dncService.isBlocked(lead.phoneNumber, campaignId);
      if (isBlocked) {
        this.logger.debug(`Lead ${lead.id} (${lead.phoneNumber}) blocked by DNC`);
        await this.leadsRepository.update(lead.id, { status: 'dnc' });
        continue;
      }

      // Check calling hours
      if (!this.isLeadWithinCallingHours(lead, campaign, now)) {
        this.logger.debug(`Lead ${lead.id} (${lead.phoneNumber}) outside calling hours for state ${lead.state}`);
        continue; // Skip but don't mark - will try again later
      }

      cleanLeads.push(lead);
    }

    return cleanLeads;
  }

  /**
   * Check if a lead is within allowed calling hours based on:
   * 1. Campaign's custom calling hours (if set)
   * 2. State-specific TCPA rules (if respectStateRules is true)
   */
  private isLeadWithinCallingHours(lead: Lead, campaign: Campaign, now: Date): boolean {
    const leadTimezone = lead.timezone || inferTimezoneFromState(lead.state);

    // Convert current time to lead's local time
    const localTimeStr = now.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      timeZone: leadTimezone,
    });

    const localDate = new Date(now.toLocaleString('en-US', { timeZone: leadTimezone }));
    const dayOfWeek = localDate.getDay();

    // Check campaign-level calling hours first
    if (campaign.callingHours) {
      const hours = campaign.callingHours;
      let allowedRange: { start: string; end: string } | null = null;

      if (dayOfWeek === 0) {
        allowedRange = hours.sunday;
      } else if (dayOfWeek === 6) {
        allowedRange = hours.saturday;
      } else {
        allowedRange = hours.weekday;
      }

      if (!allowedRange) {
        return false; // No calls allowed on this day per campaign settings
      }

      if (localTimeStr < allowedRange.start || localTimeStr >= allowedRange.end) {
        return false; // Outside campaign calling hours
      }
    }

    // Check state-specific rules if enabled
    if (campaign.respectStateRules && lead.state) {
      return isWithinStateCallingHours(lead.state, now);
    }

    // Default: allow if no specific rules configured
    return true;
  }

  private async dialLead(campaign: Campaign, lead: Lead): Promise<void> {
    // Mark lead as dialing
    await this.leadsRepository.update(lead.id, {
      status: 'dialing',
      dialAttempts: lead.dialAttempts + 1,
      lastDialedAt: new Date(),
    });

    // Select caller ID based on local presence settings
    let callerId = campaign.defaultCallerId;
    let callerIdUsageLogId: string | null = null;

    if (campaign.localPresenceEnabled && campaign.callerIdPoolId) {
      try {
        const selectedNumber = await this.callerIdService.selectCallerIdForLead(
          campaign.callerIdPoolId,
          lead.phoneNumber,
          campaign.id,
        );

        if (selectedNumber) {
          callerId = selectedNumber.phoneNumber;
          // Record usage for tracking
          const usageLog = await this.callerIdService.recordCallStart(
            selectedNumber.id,
            lead.id,
            campaign.id,
            lead.phoneNumber,
          );
          callerIdUsageLogId = usageLog.id;
          this.logger.debug(`Selected caller ID ${callerId} (area code ${selectedNumber.areaCode}) for lead ${lead.id}`);
        } else if (campaign.callerIdStrategy === 'pool_only') {
          this.logger.warn(`No caller ID available in pool for lead ${lead.id}, skipping`);
          await this.leadsRepository.update(lead.id, { status: 'new' });
          return;
        }
        // If pool_first or default_only, fall through to defaultCallerId
      } catch (err) {
        this.logger.error(`Error selecting caller ID: ${err.message}`);
        // Fall through to defaultCallerId
      }
    }

    // Initiate call via agent
    try {
      await this.agentsService.dialOutbound(campaign.aiAgentId!, {
        toNumber: lead.phoneNumber,
        fromNumber: callerId || undefined,
        trunkId: campaign.outboundTrunkId || undefined,
        metadata: {
          campaignId: campaign.id,
          leadId: lead.id,
          attemptNumber: lead.dialAttempts + 1,
          callerIdUsageLogId,
        },
        timeout: campaign.ringTimeout,
      });

      this.logger.log(`Dialing lead ${lead.id} (${lead.phoneNumber}) with caller ID ${callerId || 'default'} for campaign ${campaign.name}`);
    } catch (err) {
      // Revert lead status on failure
      await this.leadsRepository.update(lead.id, {
        status: 'new',
        dialAttempts: lead.dialAttempts, // Don't increment on failure
      });
      throw err;
    }
  }

  // Called when a call ends (from webhook)
  async handleCallResult(
    campaignId: string,
    leadId: string,
    result: 'answered' | 'no-answer' | 'busy' | 'failed',
  ): Promise<void> {
    const active = this.activeCampaigns.get(campaignId);
    if (active) {
      active.callsInProgress = Math.max(0, active.callsInProgress - 1);

      if (result === 'answered') {
        active.callsCompleted++;
      } else {
        // Could be considered abandoned depending on timing
        // For now, just don't count as completed
      }
    }

    // Update lead based on result
    const lead = await this.leadsRepository.findOne({ where: { id: leadId } });
    if (lead) {
      if (result === 'answered') {
        // Lead was contacted - will be dispositioned separately
        await this.leadsRepository.update(leadId, { status: 'contacted' });
      } else {
        // Not answered - check retry logic
        const campaign = await this.campaignsRepository.findOne({
          where: { id: campaignId },
        });

        if (campaign && lead.dialAttempts < campaign.maxAttemptsPerLead) {
          // Schedule retry
          await this.leadsRepository.update(leadId, {
            status: 'new',
            nextDialAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min retry
          });
        } else {
          // Max attempts reached
          await this.leadsRepository.update(leadId, { status: 'completed' });
        }
      }

      await this.campaignsService.updateListStats(lead.listId);
    }

    this.callUpdatesGateway.notifyDataChanged('dialer', 'call_result', JSON.stringify({
      campaignId,
      leadId,
      result,
    }));
  }
}
