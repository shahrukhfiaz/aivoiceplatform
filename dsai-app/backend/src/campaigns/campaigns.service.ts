import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Agent } from '../agents/agent.entity';
import { Trunk } from '../trunks/trunk.entity';
import { Campaign, CampaignStatus } from './campaign.entity';
import { CampaignList } from './campaign-list.entity';
import { Lead } from '../leads/lead.entity';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { CreateListDto } from './dto/create-list.dto';
import { CallUpdatesGateway } from '../webhooks/call-updates.gateway';
import {
  buildPaginatedResult,
  getPagination,
  PaginatedResult,
  PaginationQuery,
} from '../common/pagination';

export interface CampaignStats {
  totalLeads: number;
  newLeads: number;
  dialingLeads: number;
  contactedLeads: number;
  completedLeads: number;
  callbackLeads: number;
  dncLeads: number;
  listsCount: number;
}

@Injectable()
export class CampaignsService {
  constructor(
    @InjectRepository(Campaign)
    private readonly campaignsRepository: Repository<Campaign>,
    @InjectRepository(CampaignList)
    private readonly listsRepository: Repository<CampaignList>,
    @InjectRepository(Lead)
    private readonly leadsRepository: Repository<Lead>,
    @InjectRepository(Agent)
    private readonly agentsRepository: Repository<Agent>,
    @InjectRepository(Trunk)
    private readonly trunksRepository: Repository<Trunk>,
    private readonly callUpdatesGateway: CallUpdatesGateway,
  ) {}

  async create(dto: CreateCampaignDto): Promise<Campaign> {
    const name = dto.name.trim();

    const existing = await this.campaignsRepository.findOne({ where: { name } });
    if (existing) {
      throw new ConflictException('Campaign name already exists');
    }

    // Validate agent if provided
    let aiAgent: Agent | null = null;
    if (dto.aiAgentId) {
      aiAgent = await this.agentsRepository.findOne({
        where: { id: dto.aiAgentId },
      });
      if (!aiAgent) {
        throw new NotFoundException('AI Agent not found');
      }
    }

    // Validate trunk if provided
    let outboundTrunk: Trunk | null = null;
    if (dto.outboundTrunkId) {
      outboundTrunk = await this.trunksRepository.findOne({
        where: { id: dto.outboundTrunkId },
      });
      if (!outboundTrunk) {
        throw new NotFoundException('Outbound trunk not found');
      }
    }

    const campaign = this.campaignsRepository.create({
      name,
      description: dto.description,
      status: 'paused',
      dialingMode: dto.dialingMode ?? 'predictive',
      aiAgent,
      aiAgentId: dto.aiAgentId,
      outboundTrunk,
      outboundTrunkId: dto.outboundTrunkId,
      callsPerAgent: dto.callsPerAgent ?? 1.5,
      maxAbandonRate: dto.maxAbandonRate ?? 3,
      ringTimeout: dto.ringTimeout ?? 30,
      wrapUpTime: dto.wrapUpTime ?? 30,
      maxAttemptsPerLead: dto.maxAttemptsPerLead ?? 3,
      defaultCallerId: dto.defaultCallerId,
      schedule: dto.schedule,
      script: dto.script,
    });

    const saved = await this.campaignsRepository.save(campaign);
    this.callUpdatesGateway.notifyDataChanged('campaign', 'created', saved.id);
    return saved;
  }

  async findAll(query: PaginationQuery): Promise<PaginatedResult<Campaign>> {
    const { skip, take, page, limit } = getPagination(query);
    const [data, total] = await this.campaignsRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip,
      take,
      relations: ['aiAgent', 'outboundTrunk'],
    });

    // Add basic stats
    for (const campaign of data) {
      const stats = await this.getStats(campaign.id);
      campaign.totalLeads = stats.totalLeads;
      campaign.dialedLeads = stats.contactedLeads + stats.completedLeads;
      campaign.contactedLeads = stats.contactedLeads;
    }

    return buildPaginatedResult(data, total, page, limit);
  }

  async findOne(id: string): Promise<Campaign | null> {
    return this.campaignsRepository.findOne({
      where: { id },
      relations: ['aiAgent', 'outboundTrunk', 'lists'],
    });
  }

  async getStats(campaignId: string): Promise<CampaignStats> {
    const lists = await this.listsRepository.find({
      where: { campaignId },
    });

    const listIds = lists.map((l) => l.id);

    if (listIds.length === 0) {
      return {
        totalLeads: 0,
        newLeads: 0,
        dialingLeads: 0,
        contactedLeads: 0,
        completedLeads: 0,
        callbackLeads: 0,
        dncLeads: 0,
        listsCount: 0,
      };
    }

    const qb = this.leadsRepository.createQueryBuilder('lead');
    qb.where('lead.listId IN (:...listIds)', { listIds });

    const total = await qb.getCount();

    const statusCounts = await this.leadsRepository
      .createQueryBuilder('lead')
      .select('lead.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('lead.listId IN (:...listIds)', { listIds })
      .groupBy('lead.status')
      .getRawMany();

    const counts: Record<string, number> = {};
    for (const row of statusCounts) {
      counts[row.status] = parseInt(row.count, 10);
    }

    return {
      totalLeads: total,
      newLeads: counts['new'] || 0,
      dialingLeads: counts['dialing'] || 0,
      contactedLeads: counts['contacted'] || 0,
      completedLeads: counts['completed'] || 0,
      callbackLeads: counts['callback'] || 0,
      dncLeads: counts['dnc'] || 0,
      listsCount: lists.length,
    };
  }

  async update(id: string, dto: UpdateCampaignDto): Promise<Campaign> {
    const campaign = await this.campaignsRepository.findOne({
      where: { id },
      relations: ['aiAgent', 'outboundTrunk'],
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (dto.name && dto.name.trim() !== campaign.name) {
      const newName = dto.name.trim();
      const existing = await this.campaignsRepository.findOne({
        where: { name: newName },
      });
      if (existing) {
        throw new ConflictException('Campaign name already exists');
      }
      campaign.name = newName;
    }

    if (dto.description !== undefined) {
      campaign.description = dto.description;
    }

    if (dto.status !== undefined) {
      campaign.status = dto.status;
    }

    if (dto.dialingMode !== undefined) {
      campaign.dialingMode = dto.dialingMode;
    }

    if (dto.aiAgentId !== undefined) {
      if (dto.aiAgentId === null) {
        campaign.aiAgent = null;
        campaign.aiAgentId = null;
      } else {
        const agent = await this.agentsRepository.findOne({
          where: { id: dto.aiAgentId },
        });
        if (!agent) {
          throw new NotFoundException('AI Agent not found');
        }
        campaign.aiAgent = agent;
        campaign.aiAgentId = dto.aiAgentId;
      }
    }

    if (dto.outboundTrunkId !== undefined) {
      if (dto.outboundTrunkId === null) {
        campaign.outboundTrunk = null;
        campaign.outboundTrunkId = null;
      } else {
        const trunk = await this.trunksRepository.findOne({
          where: { id: dto.outboundTrunkId },
        });
        if (!trunk) {
          throw new NotFoundException('Outbound trunk not found');
        }
        campaign.outboundTrunk = trunk;
        campaign.outboundTrunkId = dto.outboundTrunkId;
      }
    }

    if (dto.callsPerAgent !== undefined) {
      campaign.callsPerAgent = dto.callsPerAgent;
    }

    if (dto.maxAbandonRate !== undefined) {
      campaign.maxAbandonRate = dto.maxAbandonRate;
    }

    if (dto.ringTimeout !== undefined) {
      campaign.ringTimeout = dto.ringTimeout;
    }

    if (dto.wrapUpTime !== undefined) {
      campaign.wrapUpTime = dto.wrapUpTime;
    }

    if (dto.maxAttemptsPerLead !== undefined) {
      campaign.maxAttemptsPerLead = dto.maxAttemptsPerLead;
    }

    if (dto.defaultCallerId !== undefined) {
      campaign.defaultCallerId = dto.defaultCallerId;
    }

    if (dto.schedule !== undefined) {
      campaign.schedule = dto.schedule;
    }

    if (dto.script !== undefined) {
      campaign.script = dto.script;
    }

    const saved = await this.campaignsRepository.save(campaign);
    this.callUpdatesGateway.notifyDataChanged('campaign', 'updated', saved.id);
    return saved;
  }

  async remove(id: string): Promise<void> {
    const campaign = await this.campaignsRepository.findOne({ where: { id } });
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (campaign.status === 'active') {
      throw new BadRequestException('Cannot delete an active campaign. Stop it first.');
    }

    await this.campaignsRepository.remove(campaign);
    this.callUpdatesGateway.notifyDataChanged('campaign', 'deleted', id);
  }

  // Campaign control methods
  async start(id: string): Promise<Campaign> {
    const campaign = await this.findOne(id);
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (!campaign.aiAgentId) {
      throw new BadRequestException('Campaign must have an AI agent assigned');
    }

    if (!campaign.outboundTrunkId) {
      throw new BadRequestException('Campaign must have an outbound trunk assigned');
    }

    campaign.status = 'active';
    const saved = await this.campaignsRepository.save(campaign);
    this.callUpdatesGateway.notifyDataChanged('campaign', 'started', saved.id);
    return saved;
  }

  async pause(id: string): Promise<Campaign> {
    const campaign = await this.findOne(id);
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    campaign.status = 'paused';
    const saved = await this.campaignsRepository.save(campaign);
    this.callUpdatesGateway.notifyDataChanged('campaign', 'paused', saved.id);
    return saved;
  }

  async stop(id: string): Promise<Campaign> {
    const campaign = await this.findOne(id);
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    campaign.status = 'completed';
    const saved = await this.campaignsRepository.save(campaign);
    this.callUpdatesGateway.notifyDataChanged('campaign', 'stopped', saved.id);
    return saved;
  }

  // List management
  async createList(campaignId: string, dto: CreateListDto): Promise<CampaignList> {
    const campaign = await this.campaignsRepository.findOne({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const list = this.listsRepository.create({
      name: dto.name.trim(),
      campaignId,
      priority: dto.priority ?? 0,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
    });

    return this.listsRepository.save(list);
  }

  async findLists(campaignId: string): Promise<CampaignList[]> {
    return this.listsRepository.find({
      where: { campaignId },
      order: { priority: 'DESC', createdAt: 'DESC' },
    });
  }

  async removeList(campaignId: string, listId: string): Promise<void> {
    const list = await this.listsRepository.findOne({
      where: { id: listId, campaignId },
    });

    if (!list) {
      throw new NotFoundException('List not found');
    }

    await this.listsRepository.remove(list);
  }

  async updateListStats(listId: string): Promise<void> {
    const total = await this.leadsRepository.count({ where: { listId } });
    const contacted = await this.leadsRepository.count({
      where: { listId, status: 'contacted' },
    });

    await this.listsRepository.update(listId, {
      totalLeads: total,
      contactedLeads: contacted,
    });
  }
}
