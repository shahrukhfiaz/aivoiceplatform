import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Disposition, DispositionCategory } from './disposition.entity';
import { CreateDispositionDto } from './dto/create-disposition.dto';
import { UpdateDispositionDto } from './dto/update-disposition.dto';
import {
  buildPaginatedResult,
  getPagination,
  PaginatedResult,
  PaginationQuery,
} from '../common/pagination';

interface SystemDisposition {
  code: string;
  name: string;
  category: DispositionCategory;
  markAsDnc: boolean;
  scheduleCallback: boolean;
  retryAfterMinutes?: number;
  sortOrder: number;
}

const SYSTEM_DISPOSITIONS: SystemDisposition[] = [
  { code: 'SALE', name: 'Sale', category: 'positive', markAsDnc: false, scheduleCallback: false, sortOrder: 1 },
  { code: 'APPT', name: 'Appointment Set', category: 'positive', markAsDnc: false, scheduleCallback: false, sortOrder: 2 },
  { code: 'CB', name: 'Callback Requested', category: 'callback', markAsDnc: false, scheduleCallback: true, sortOrder: 3 },
  { code: 'NI', name: 'Not Interested', category: 'negative', markAsDnc: false, scheduleCallback: false, sortOrder: 4 },
  { code: 'DNC', name: 'Do Not Call', category: 'negative', markAsDnc: true, scheduleCallback: false, sortOrder: 5 },
  { code: 'WN', name: 'Wrong Number', category: 'negative', markAsDnc: false, scheduleCallback: false, sortOrder: 6 },
  { code: 'NA', name: 'No Answer', category: 'neutral', markAsDnc: false, scheduleCallback: false, retryAfterMinutes: 60, sortOrder: 7 },
  { code: 'BUSY', name: 'Busy', category: 'neutral', markAsDnc: false, scheduleCallback: false, retryAfterMinutes: 30, sortOrder: 8 },
  { code: 'VM', name: 'Voicemail', category: 'neutral', markAsDnc: false, scheduleCallback: false, retryAfterMinutes: 120, sortOrder: 9 },
  { code: 'DISC', name: 'Disconnected', category: 'negative', markAsDnc: false, scheduleCallback: false, sortOrder: 10 },
];

@Injectable()
export class DispositionsService implements OnModuleInit {
  constructor(
    @InjectRepository(Disposition)
    private readonly dispositionsRepository: Repository<Disposition>,
  ) {}

  async onModuleInit() {
    await this.seedSystemDispositions();
  }

  private async seedSystemDispositions() {
    for (const disp of SYSTEM_DISPOSITIONS) {
      const existing = await this.dispositionsRepository.findOne({
        where: { code: disp.code },
      });
      if (!existing) {
        await this.dispositionsRepository.save({
          ...disp,
          isSystem: true,
        });
      }
    }
  }

  async create(dto: CreateDispositionDto): Promise<Disposition> {
    const code = dto.code.toUpperCase().trim();

    const existing = await this.dispositionsRepository.findOne({
      where: { code },
    });
    if (existing) {
      throw new ConflictException('Disposition code already exists');
    }

    const disposition = this.dispositionsRepository.create({
      code,
      name: dto.name.trim(),
      category: dto.category ?? 'neutral',
      markAsDnc: dto.markAsDnc ?? false,
      scheduleCallback: dto.scheduleCallback ?? false,
      retryAfterMinutes: dto.retryAfterMinutes,
      sortOrder: dto.sortOrder ?? 0,
      isSystem: false,
    });

    return this.dispositionsRepository.save(disposition);
  }

  async findAll(query: PaginationQuery): Promise<PaginatedResult<Disposition>> {
    const { skip, take, page, limit } = getPagination(query);
    const [data, total] = await this.dispositionsRepository.findAndCount({
      order: { sortOrder: 'ASC', code: 'ASC' },
      skip,
      take,
    });
    return buildPaginatedResult(data, total, page, limit);
  }

  async findAllNoPagination(): Promise<Disposition[]> {
    return this.dispositionsRepository.find({
      order: { sortOrder: 'ASC', code: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Disposition | null> {
    return this.dispositionsRepository.findOne({ where: { id } });
  }

  async findByCode(code: string): Promise<Disposition | null> {
    return this.dispositionsRepository.findOne({
      where: { code: code.toUpperCase() },
    });
  }

  async update(id: string, dto: UpdateDispositionDto): Promise<Disposition> {
    const disposition = await this.dispositionsRepository.findOne({
      where: { id },
    });

    if (!disposition) {
      throw new NotFoundException('Disposition not found');
    }

    if (disposition.isSystem && (dto.code || dto.category)) {
      throw new BadRequestException('Cannot modify code or category of system dispositions');
    }

    if (dto.code && dto.code.toUpperCase().trim() !== disposition.code) {
      const newCode = dto.code.toUpperCase().trim();
      const existing = await this.dispositionsRepository.findOne({
        where: { code: newCode },
      });
      if (existing) {
        throw new ConflictException('Disposition code already exists');
      }
      disposition.code = newCode;
    }

    if (dto.name !== undefined) {
      disposition.name = dto.name.trim();
    }

    if (dto.category !== undefined && !disposition.isSystem) {
      disposition.category = dto.category;
    }

    if (dto.markAsDnc !== undefined) {
      disposition.markAsDnc = dto.markAsDnc;
    }

    if (dto.scheduleCallback !== undefined) {
      disposition.scheduleCallback = dto.scheduleCallback;
    }

    if (dto.retryAfterMinutes !== undefined) {
      disposition.retryAfterMinutes = dto.retryAfterMinutes;
    }

    if (dto.sortOrder !== undefined) {
      disposition.sortOrder = dto.sortOrder;
    }

    return this.dispositionsRepository.save(disposition);
  }

  async remove(id: string): Promise<void> {
    const disposition = await this.dispositionsRepository.findOne({
      where: { id },
    });

    if (!disposition) {
      throw new NotFoundException('Disposition not found');
    }

    if (disposition.isSystem) {
      throw new BadRequestException('Cannot delete system dispositions');
    }

    await this.dispositionsRepository.remove(disposition);
  }
}
