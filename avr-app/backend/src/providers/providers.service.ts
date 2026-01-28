import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateProviderDto } from './dto/create-provider.dto';
import { UpdateProviderDto } from './dto/update-provider.dto';
import { Provider } from './provider.entity';
import { Agent } from '../agents/agent.entity';
import {
  buildPaginatedResult,
  getPagination,
  PaginatedResult,
  PaginationQuery,
} from '../common/pagination';

@Injectable()
export class ProvidersService {
  private readonly logger = new Logger(ProvidersService.name);

  constructor(
    @InjectRepository(Provider)
    private readonly providerRepository: Repository<Provider>,
    @InjectRepository(Agent)
    private readonly agentRepository: Repository<Agent>,
  ) {}

  async create(createProviderDto: CreateProviderDto): Promise<Provider> {
    const existing = await this.providerRepository.findOne({
      where: { name: createProviderDto.name },
    });

    if (existing) {
      throw new ConflictException('Provider name already exists');
    }

    const provider = this.providerRepository.create(createProviderDto);
    return this.providerRepository.save(provider);
  }

  async findAll(query: PaginationQuery): Promise<PaginatedResult<Provider>> {
    const { skip, take, page, limit } = getPagination(query);
    const [data, total] = await this.providerRepository.findAndCount({
      skip,
      take,
    });
    return buildPaginatedResult(data, total, page, limit);
  }

  async findById(id: string): Promise<Provider> {
    const provider = await this.providerRepository.findOne({ where: { id } });
    if (!provider) {
      throw new NotFoundException('Provider not found');
    }
    return provider;
  }

  async update(
    id: string,
    updateProviderDto: UpdateProviderDto,
  ): Promise<Provider> {
    const provider = await this.providerRepository.findOne({ where: { id } });
    if (!provider) {
      throw new NotFoundException('Provider not found');
    }

    if (updateProviderDto.name && updateProviderDto.name !== provider.name) {
      const existing = await this.providerRepository.findOne({
        where: { name: updateProviderDto.name },
      });
      if (existing) {
        throw new ConflictException('Provider name already exists');
      }
      provider.name = updateProviderDto.name;
    }

    if (updateProviderDto.type) {
      provider.type = updateProviderDto.type;
    }

    if (updateProviderDto.config !== undefined) {
      provider.config = updateProviderDto.config;
    }

    const saved = await this.providerRepository.save(provider);
    
    // Log that provider config was updated - containers will pick up changes on next call
    // STS containers fetch config dynamically from database on each new call (100ms cache)
    // No container restart needed - changes apply immediately to new calls
    this.logger.log(`Provider ${saved.name} (${saved.id}) configuration updated. Running agents will use new config on next call.`);
    
    return saved;
  }

  async remove(id: string): Promise<void> {
    const provider = await this.providerRepository.findOne({ where: { id } });
    if (!provider) {
      throw new NotFoundException('Provider not found');
    }

    this.logger.log(`Deleting provider ${id}: unlinking agents...`);

    // Unlink agents that reference this provider (ASR)
    await this.agentRepository
      .createQueryBuilder()
      .update(Agent)
      .set({ providerAsr: null })
      .where('provider_asr_id = :id', { id })
      .execute();

    // Unlink agents that reference this provider (LLM)
    await this.agentRepository
      .createQueryBuilder()
      .update(Agent)
      .set({ providerLlm: null })
      .where('provider_llm_id = :id', { id })
      .execute();

    // Unlink agents that reference this provider (TTS)
    await this.agentRepository
      .createQueryBuilder()
      .update(Agent)
      .set({ providerTts: null })
      .where('provider_tts_id = :id', { id })
      .execute();

    // Unlink agents that reference this provider (STS)
    await this.agentRepository
      .createQueryBuilder()
      .update(Agent)
      .set({ providerSts: null })
      .where('provider_sts_id = :id', { id })
      .execute();

    // Now delete the provider
    this.logger.log(`Deleting provider ${id}: removing from database...`);
    const result = await this.providerRepository.delete({ id });
    if (!result.affected) {
      throw new NotFoundException('Provider not found');
    }

    this.logger.log(`Provider ${id} deleted successfully`);
  }
}
