import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branding } from './branding.entity';
import { UpdateBrandingDto } from './dto/update-branding.dto';

@Injectable()
export class BrandingService {
  private readonly logger = new Logger(BrandingService.name);

  constructor(
    @InjectRepository(Branding)
    private readonly brandingRepository: Repository<Branding>,
  ) {}

  /**
   * Get the current branding configuration.
   * If no branding exists, create default branding.
   */
  async get(): Promise<Branding> {
    let branding = await this.brandingRepository.findOne({
      where: {},
      order: { createdAt: 'ASC' },
    });

    if (!branding) {
      this.logger.log('No branding configuration found, creating default...');
      branding = await this.createDefault();
    }

    return branding;
  }

  /**
   * Update the branding configuration.
   * Always updates the first (and only) record.
   */
  async update(updateBrandingDto: UpdateBrandingDto): Promise<Branding> {
    let branding = await this.brandingRepository.findOne({
      where: {},
      order: { createdAt: 'ASC' },
    });

    if (!branding) {
      branding = await this.createDefault();
    }

    // Update fields
    Object.assign(branding, updateBrandingDto);

    const updated = await this.brandingRepository.save(branding);
    this.logger.log(`Branding configuration updated: ${updated.id}`);
    return updated;
  }

  /**
   * Create default branding configuration.
   */
  private async createDefault(): Promise<Branding> {
    const branding = this.brandingRepository.create({
      appName: 'AVR Admin',
      panelName: 'AVR Admin Panel',
      logoUrl: null,
      faviconUrl: null,
      primaryColor: null,
      secondaryColor: null,
      accentColor: null,
      destructiveColor: null,
      discordUrl: 'https://discord.gg/DFTU69Hg74',
      githubUrl: 'https://github.com/orgs/agentvoiceresponse/repositories',
      wikiUrl: 'https://wiki.agentvoiceresponse.com/',
      loginTitle: null,
      loginDescription: null,
      webrtcPhoneTitle: 'AVR Phone',
    });

    const saved = await this.brandingRepository.save(branding);
    this.logger.log(`Default branding configuration created: ${saved.id}`);
    return saved;
  }

  /**
   * Initialize branding on application startup.
   */
  async onModuleInit(): Promise<void> {
    await this.get();
  }
}
