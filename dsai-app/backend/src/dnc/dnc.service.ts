import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull, Or, MoreThan } from 'typeorm';
import { DncEntry, DncSource } from './dnc-entry.entity';
import { CreateDncEntryDto } from './dto/create-dnc-entry.dto';
import { ImportDncDto, ScrubLeadsDto } from './dto/import-dnc.dto';
import {
  buildPaginatedResult,
  getPagination,
  PaginatedResult,
  PaginationQuery,
} from '../common/pagination';
import { CallUpdatesGateway } from '../webhooks/call-updates.gateway';

export interface ScrubResult {
  total: number;
  clean: string[];
  blocked: string[];
}

@Injectable()
export class DncService {
  constructor(
    @InjectRepository(DncEntry)
    private readonly dncRepository: Repository<DncEntry>,
    private readonly callUpdatesGateway: CallUpdatesGateway,
  ) {}

  // Normalize phone number (remove non-digits, handle +1)
  private normalizePhone(phone: string): string {
    let normalized = phone.replace(/\D/g, '');
    // Remove leading 1 for US numbers
    if (normalized.length === 11 && normalized.startsWith('1')) {
      normalized = normalized.substring(1);
    }
    return normalized;
  }

  async create(dto: CreateDncEntryDto, userId?: string): Promise<DncEntry> {
    const phoneNumber = this.normalizePhone(dto.phoneNumber);

    // Check for existing entry
    const existing = await this.dncRepository.findOne({
      where: {
        phoneNumber,
        campaignId: dto.campaignId || IsNull(),
      },
    });

    if (existing) {
      throw new ConflictException('Phone number already exists in DNC list');
    }

    const entry = this.dncRepository.create({
      phoneNumber,
      source: dto.source || 'internal',
      reason: dto.reason,
      campaignId: dto.campaignId || null,
      addedByUserId: userId,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
    });

    const saved = await this.dncRepository.save(entry);
    this.callUpdatesGateway.notifyDataChanged('dnc' as any, 'created', saved.id);
    return saved;
  }

  async bulkImport(dto: ImportDncDto, userId?: string): Promise<{ imported: number; skipped: number }> {
    let imported = 0;
    let skipped = 0;

    for (const entry of dto.entries) {
      const phoneNumber = this.normalizePhone(entry.phoneNumber);

      // Check for existing
      const existing = await this.dncRepository.findOne({
        where: {
          phoneNumber,
          campaignId: dto.campaignId || IsNull(),
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      const dncEntry = this.dncRepository.create({
        phoneNumber,
        source: dto.source || 'import',
        reason: entry.reason,
        campaignId: dto.campaignId || null,
        addedByUserId: userId,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      });

      await this.dncRepository.save(dncEntry);
      imported++;
    }

    this.callUpdatesGateway.notifyDataChanged('dnc' as any, 'created', 'bulk');
    return { imported, skipped };
  }

  async findAll(
    query: PaginationQuery & { campaignId?: string; source?: DncSource; search?: string },
  ): Promise<PaginatedResult<DncEntry>> {
    const { skip, take, page, limit } = getPagination(query);

    const qb = this.dncRepository.createQueryBuilder('dnc');

    if (query.campaignId) {
      qb.andWhere('dnc.campaignId = :campaignId', { campaignId: query.campaignId });
    } else {
      // Show global DNC if no campaign specified
      qb.andWhere('dnc.campaignId IS NULL');
    }

    if (query.source) {
      qb.andWhere('dnc.source = :source', { source: query.source });
    }

    if (query.search) {
      qb.andWhere('dnc.phoneNumber LIKE :search', { search: `%${query.search}%` });
    }

    qb.orderBy('dnc.createdAt', 'DESC');
    qb.skip(skip).take(take);

    const [data, total] = await qb.getManyAndCount();
    return buildPaginatedResult(data, total, page, limit);
  }

  async findOne(id: string): Promise<DncEntry | null> {
    return this.dncRepository.findOne({
      where: { id },
      relations: ['campaign', 'addedByUser'],
    });
  }

  async remove(id: string): Promise<void> {
    const entry = await this.dncRepository.findOne({ where: { id } });
    if (!entry) {
      throw new NotFoundException('DNC entry not found');
    }

    await this.dncRepository.remove(entry);
    this.callUpdatesGateway.notifyDataChanged('dnc' as any, 'deleted', id);
  }

  // Check if a phone number is on DNC list
  async isBlocked(phoneNumber: string, campaignId?: string): Promise<boolean> {
    const normalized = this.normalizePhone(phoneNumber);
    const now = new Date();

    const entry = await this.dncRepository.findOne({
      where: [
        // Global DNC (not expired: expiresAt is null or in the future)
        {
          phoneNumber: normalized,
          campaignId: IsNull(),
          expiresAt: Or(IsNull(), MoreThan(now)),
        },
        // Campaign-specific DNC (if campaign provided)
        ...(campaignId
          ? [
              {
                phoneNumber: normalized,
                campaignId,
                expiresAt: Or(IsNull(), MoreThan(now)),
              },
            ]
          : []),
      ],
    });

    return !!entry;
  }

  // Scrub a list of phone numbers against DNC
  async scrubList(dto: ScrubLeadsDto): Promise<ScrubResult> {
    const clean: string[] = [];
    const blocked: string[] = [];

    for (const phone of dto.phoneNumbers) {
      const isBlocked = await this.isBlocked(phone, dto.campaignId);
      if (isBlocked) {
        blocked.push(phone);
      } else {
        clean.push(phone);
      }
    }

    return {
      total: dto.phoneNumbers.length,
      clean,
      blocked,
    };
  }

  // Add phone to DNC from disposition
  async addFromDisposition(
    phoneNumber: string,
    campaignId: string | null,
    reason: string,
    userId?: string,
  ): Promise<DncEntry> {
    const normalized = this.normalizePhone(phoneNumber);

    // Check if already exists
    const existing = await this.dncRepository.findOne({
      where: {
        phoneNumber: normalized,
        campaignId: campaignId || IsNull(),
      },
    });

    if (existing) {
      return existing; // Already on DNC
    }

    const entry = this.dncRepository.create({
      phoneNumber: normalized,
      source: 'disposition',
      reason,
      campaignId: campaignId || null,
      addedByUserId: userId,
    });

    return this.dncRepository.save(entry);
  }

  // Export DNC list as array
  async exportList(campaignId?: string): Promise<DncEntry[]> {
    const qb = this.dncRepository.createQueryBuilder('dnc');

    if (campaignId) {
      qb.andWhere('(dnc.campaignId = :campaignId OR dnc.campaignId IS NULL)', { campaignId });
    } else {
      qb.andWhere('dnc.campaignId IS NULL');
    }

    qb.orderBy('dnc.createdAt', 'DESC');
    return qb.getMany();
  }

  // Get DNC stats
  async getStats(campaignId?: string): Promise<{ total: number; bySource: Record<string, number> }> {
    const qb = this.dncRepository.createQueryBuilder('dnc');

    if (campaignId) {
      qb.andWhere('(dnc.campaignId = :campaignId OR dnc.campaignId IS NULL)', { campaignId });
    } else {
      qb.andWhere('dnc.campaignId IS NULL');
    }

    const total = await qb.getCount();

    const bySource = await this.dncRepository
      .createQueryBuilder('dnc')
      .select('dnc.source', 'source')
      .addSelect('COUNT(*)', 'count')
      .where(campaignId ? '(dnc.campaignId = :campaignId OR dnc.campaignId IS NULL)' : 'dnc.campaignId IS NULL', { campaignId })
      .groupBy('dnc.source')
      .getRawMany();

    const sourceMap: Record<string, number> = {};
    for (const row of bySource) {
      sourceMap[row.source] = parseInt(row.count, 10);
    }

    return { total, bySource: sourceMap };
  }
}
