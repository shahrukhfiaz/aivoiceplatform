import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Lead, LeadStatus } from './lead.entity';
import { CampaignList } from '../campaigns/campaign-list.entity';
import { Disposition } from '../dispositions/disposition.entity';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { UploadLeadsDto, FieldMapping } from './dto/upload-leads.dto';
import { CampaignsService } from '../campaigns/campaigns.service';
import {
  buildPaginatedResult,
  getPagination,
  PaginatedResult,
  PaginationQuery,
} from '../common/pagination';

export interface LeadFilter extends PaginationQuery {
  listId?: string;
  campaignId?: string;
  status?: LeadStatus;
  dispositionId?: string;
}

@Injectable()
export class LeadsService {
  constructor(
    @InjectRepository(Lead)
    private readonly leadsRepository: Repository<Lead>,
    @InjectRepository(CampaignList)
    private readonly listsRepository: Repository<CampaignList>,
    @InjectRepository(Disposition)
    private readonly dispositionsRepository: Repository<Disposition>,
    private readonly campaignsService: CampaignsService,
  ) {}

  async create(dto: CreateLeadDto): Promise<Lead> {
    const list = await this.listsRepository.findOne({
      where: { id: dto.listId },
    });

    if (!list) {
      throw new NotFoundException('List not found');
    }

    const lead = this.leadsRepository.create({
      listId: dto.listId,
      phoneNumber: this.normalizePhone(dto.phoneNumber),
      altPhone1: dto.altPhone1 ? this.normalizePhone(dto.altPhone1) : null,
      altPhone2: dto.altPhone2 ? this.normalizePhone(dto.altPhone2) : null,
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      address: dto.address,
      city: dto.city,
      state: dto.state,
      zipCode: dto.zipCode,
      timezone: dto.timezone,
      customFields: dto.customFields,
      priority: dto.priority ?? 0,
      status: 'new',
    });

    const saved = await this.leadsRepository.save(lead);
    await this.campaignsService.updateListStats(dto.listId);
    return saved;
  }

  async uploadLeads(dto: UploadLeadsDto): Promise<{ imported: number; skipped: number }> {
    const list = await this.listsRepository.findOne({
      where: { id: dto.listId },
    });

    if (!list) {
      throw new NotFoundException('List not found');
    }

    const fieldMap = new Map<string, string>();
    for (const mapping of dto.fieldMappings) {
      fieldMap.set(mapping.csvField, mapping.leadField);
    }

    let imported = 0;
    let skipped = 0;

    for (const row of dto.data) {
      try {
        const leadData: Partial<Lead> = {
          listId: dto.listId,
          status: 'new',
          dialAttempts: 0,
          priority: 0,
        };

        const customFields: Record<string, unknown> = {};

        for (const [csvField, value] of Object.entries(row)) {
          const leadField = fieldMap.get(csvField);
          if (!leadField) continue;

          if (leadField === 'phoneNumber') {
            leadData.phoneNumber = this.normalizePhone(value);
          } else if (leadField === 'altPhone1') {
            leadData.altPhone1 = this.normalizePhone(value);
          } else if (leadField === 'altPhone2') {
            leadData.altPhone2 = this.normalizePhone(value);
          } else if (leadField === 'firstName') {
            leadData.firstName = value;
          } else if (leadField === 'lastName') {
            leadData.lastName = value;
          } else if (leadField === 'email') {
            leadData.email = value;
          } else if (leadField === 'address') {
            leadData.address = value;
          } else if (leadField === 'city') {
            leadData.city = value;
          } else if (leadField === 'state') {
            leadData.state = value;
          } else if (leadField === 'zipCode') {
            leadData.zipCode = value;
          } else if (leadField === 'timezone') {
            leadData.timezone = value;
          } else if (leadField === 'priority') {
            leadData.priority = parseInt(value, 10) || 0;
          } else {
            // Custom field
            customFields[leadField] = value;
          }
        }

        if (!leadData.phoneNumber) {
          skipped++;
          continue;
        }

        if (Object.keys(customFields).length > 0) {
          leadData.customFields = customFields;
        }

        await this.leadsRepository.save(this.leadsRepository.create(leadData));
        imported++;
      } catch {
        skipped++;
      }
    }

    await this.campaignsService.updateListStats(dto.listId);
    return { imported, skipped };
  }

  async findAll(filter: LeadFilter): Promise<PaginatedResult<Lead>> {
    const { skip, take, page, limit } = getPagination(filter);

    const qb = this.leadsRepository.createQueryBuilder('lead');
    qb.leftJoinAndSelect('lead.disposition', 'disposition');
    qb.leftJoinAndSelect('lead.list', 'list');

    if (filter.listId) {
      qb.andWhere('lead.listId = :listId', { listId: filter.listId });
    }

    if (filter.campaignId) {
      qb.andWhere('list.campaignId = :campaignId', { campaignId: filter.campaignId });
    }

    if (filter.status) {
      qb.andWhere('lead.status = :status', { status: filter.status });
    }

    if (filter.dispositionId) {
      qb.andWhere('lead.dispositionId = :dispositionId', {
        dispositionId: filter.dispositionId,
      });
    }

    qb.orderBy('lead.priority', 'DESC');
    qb.addOrderBy('lead.createdAt', 'DESC');
    qb.skip(skip).take(take);

    const [data, total] = await qb.getManyAndCount();
    return buildPaginatedResult(data, total, page, limit);
  }

  async findOne(id: string): Promise<Lead | null> {
    return this.leadsRepository.findOne({
      where: { id },
      relations: ['disposition', 'list'],
    });
  }

  async update(id: string, dto: UpdateLeadDto): Promise<Lead> {
    const lead = await this.leadsRepository.findOne({
      where: { id },
      relations: ['list'],
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    if (dto.phoneNumber !== undefined) {
      lead.phoneNumber = this.normalizePhone(dto.phoneNumber);
    }

    if (dto.altPhone1 !== undefined) {
      lead.altPhone1 = dto.altPhone1 ? this.normalizePhone(dto.altPhone1) : null;
    }

    if (dto.altPhone2 !== undefined) {
      lead.altPhone2 = dto.altPhone2 ? this.normalizePhone(dto.altPhone2) : null;
    }

    if (dto.firstName !== undefined) lead.firstName = dto.firstName;
    if (dto.lastName !== undefined) lead.lastName = dto.lastName;
    if (dto.email !== undefined) lead.email = dto.email;
    if (dto.address !== undefined) lead.address = dto.address;
    if (dto.city !== undefined) lead.city = dto.city;
    if (dto.state !== undefined) lead.state = dto.state;
    if (dto.zipCode !== undefined) lead.zipCode = dto.zipCode;
    if (dto.timezone !== undefined) lead.timezone = dto.timezone;
    if (dto.customFields !== undefined) lead.customFields = dto.customFields;
    if (dto.priority !== undefined) lead.priority = dto.priority;
    if (dto.status !== undefined) lead.status = dto.status;
    if (dto.notes !== undefined) lead.notes = dto.notes;

    if (dto.dispositionId !== undefined) {
      if (dto.dispositionId === null) {
        lead.disposition = null;
        lead.dispositionId = null;
      } else {
        const disposition = await this.dispositionsRepository.findOne({
          where: { id: dto.dispositionId },
        });
        if (!disposition) {
          throw new NotFoundException('Disposition not found');
        }
        lead.disposition = disposition;
        lead.dispositionId = dto.dispositionId;
      }
    }

    const saved = await this.leadsRepository.save(lead);
    await this.campaignsService.updateListStats(lead.listId);
    return saved;
  }

  async setDisposition(
    id: string,
    dispositionId: string,
    notes?: string,
  ): Promise<Lead> {
    const lead = await this.leadsRepository.findOne({
      where: { id },
      relations: ['list'],
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const disposition = await this.dispositionsRepository.findOne({
      where: { id: dispositionId },
    });

    if (!disposition) {
      throw new NotFoundException('Disposition not found');
    }

    lead.disposition = disposition;
    lead.dispositionId = dispositionId;

    if (notes !== undefined) {
      lead.notes = notes;
    }

    // Apply disposition rules
    if (disposition.markAsDnc) {
      lead.status = 'dnc';
    } else if (disposition.scheduleCallback) {
      lead.status = 'callback';
    } else if (disposition.category === 'positive' || disposition.category === 'negative') {
      lead.status = 'completed';
    } else {
      lead.status = 'contacted';
    }

    // Set retry time if applicable
    if (disposition.retryAfterMinutes && lead.status !== 'completed' && lead.status !== 'dnc') {
      lead.nextDialAt = new Date(Date.now() + disposition.retryAfterMinutes * 60 * 1000);
      lead.status = 'new'; // Ready for retry
    }

    const saved = await this.leadsRepository.save(lead);
    await this.campaignsService.updateListStats(lead.listId);
    return saved;
  }

  async remove(id: string): Promise<void> {
    const lead = await this.leadsRepository.findOne({ where: { id } });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const listId = lead.listId;
    await this.leadsRepository.remove(lead);
    await this.campaignsService.updateListStats(listId);
  }

  private normalizePhone(phone: string): string {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');

    // If starts with 1 and has 11 digits, assume US number
    if (digits.length === 11 && digits.startsWith('1')) {
      return digits;
    }

    // If 10 digits, add US country code
    if (digits.length === 10) {
      return '1' + digits;
    }

    return digits;
  }
}
