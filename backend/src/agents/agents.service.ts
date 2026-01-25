import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DockerService } from '../docker/docker.service';
import { AsteriskService } from '../asterisk/asterisk.service';
import { Provider, ProviderType } from '../providers/provider.entity';
import { CreateAgentDto } from './dto/create-agent.dto';
import { RunAgentDto } from './dto/run-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { VicidialConfigDto } from './dto/vicidial-config.dto';
import { Agent, AgentMode, AgentStatus } from './agent.entity';
import {
  buildPaginatedResult,
  getPagination,
  PaginatedResult,
  PaginationQuery,
} from '../common/pagination';

@Injectable()
export class AgentsService {
  private readonly defaultImage =
    process.env.CORE_DEFAULT_IMAGE || 'agentvoiceresponse/avr-core:latest';
  private readonly logger = new Logger(AgentsService.name);

  constructor(
    @InjectRepository(Agent)
    private readonly agentRepository: Repository<Agent>,
    @InjectRepository(Provider)
    private readonly providerRepository: Repository<Provider>,
    private readonly dockerService: DockerService,
    private readonly asteriskService: AsteriskService,
  ) {}

  async create(createAgentDto: CreateAgentDto): Promise<Agent> {
    const sipExtension = await this.generateUniqueSipExtension();
    const agent = this.agentRepository.create({
      name: createAgentDto.name,
      mode: createAgentDto.mode ?? AgentMode.PIPELINE,
      port: Math.floor(Math.random() * 1000) + 5000,
      httpPort: Math.floor(Math.random() * 1000) + 7000,
      sipExtension,
    });

    agent.providerAsr = await this.resolveProvider(
      createAgentDto.providerAsrId,
    );
    agent.providerLlm = await this.resolveProvider(
      createAgentDto.providerLlmId,
    );
    agent.providerTts = await this.resolveProvider(
      createAgentDto.providerTtsId,
    );
    agent.providerSts = await this.resolveProvider(
      createAgentDto.providerStsId,
    );

    this.assertModeRequirements(agent);

    const saved = await this.agentRepository.save(agent);
    return saved;
  }

  async findAll(query: PaginationQuery): Promise<PaginatedResult<Agent>> {
    const { skip, take, page, limit } = getPagination(query);

    const [data, total] = await this.agentRepository.findAndCount({
      skip,
      take,
    });

    return buildPaginatedResult(data, total, page, limit);
  }

  async findOne(id: string): Promise<Agent> {
    const agent = await this.agentRepository.findOne({ where: { id } });
    if (!agent) {
      throw new NotFoundException('Agent not found');
    }
    return agent;
  }

  async update(id: string, updateAgentDto: UpdateAgentDto): Promise<Agent> {
    const agent = await this.findOne(id);

    if (updateAgentDto.name) {
      agent.name = updateAgentDto.name;
    }

    if (updateAgentDto.mode) {
      agent.mode = updateAgentDto.mode;
    }

    // Retrocompatibily: if httpPort is not set, generate a random port
    if (agent.httpPort === null) {
      agent.httpPort = Math.floor(Math.random() * 1000) + 7000;
    }

    if (updateAgentDto.providerAsrId !== undefined) {
      agent.providerAsr = await this.resolveProvider(
        updateAgentDto.providerAsrId,
      );
    }
    if (updateAgentDto.providerLlmId !== undefined) {
      agent.providerLlm = await this.resolveProvider(
        updateAgentDto.providerLlmId,
      );
    }
    if (updateAgentDto.providerTtsId !== undefined) {
      agent.providerTts = await this.resolveProvider(
        updateAgentDto.providerTtsId,
      );
    }
    if (updateAgentDto.providerStsId !== undefined) {
      agent.providerSts = await this.resolveProvider(
        updateAgentDto.providerStsId,
      );
    }

    this.assertModeRequirements(agent);

    const saved = await this.agentRepository.save(agent);
    return saved;
  }

  async remove(id: string): Promise<void> {
    const agent = await this.agentRepository.findOne({ where: { id } });
    if (!agent) {
      throw new NotFoundException('Agent not found');
    }
    const names = this.getContainerNames(agent.id, agent.mode);
    for (const name of names) {
      await this.dockerService.stopContainer(name);
    }
    // TODO: remove phone related to agent from asterisk

    const result = await this.agentRepository.delete({ id });
    if (!result.affected) {
      throw new NotFoundException('Agent not found');
    }
  }

  async runAgent(id: string, runAgentDto: RunAgentDto) {
    // Load agent with numbers relation to update Asterisk dialplan
    const agent = await this.agentRepository.findOne({
      where: { id },
      relations: ['numbers']
    });
    if (!agent) {
      throw new NotFoundException('Agent not found');
    }
    const env = this.buildEnv(agent, runAgentDto.env ?? []);
    const coreEnv = this.buildEnv(agent, [
      ...(process.env.WEBHOOK_URL ? [`WEBHOOK_URL=${process.env.WEBHOOK_URL}`] : []),
      ...(process.env.WEBHOOK_SECRET ? [`WEBHOOK_SECRET=${process.env.WEBHOOK_SECRET}`] : []),
    ]);

    const containerIds: Record<string, string> = {};

    const mappedProviders: Array<[ProviderType, Provider | null]> =
      agent.mode === AgentMode.STS
        ? [[ProviderType.STS, agent.providerSts ?? null]]
        : [
            [ProviderType.ASR, agent.providerAsr ?? null],
            [ProviderType.LLM, agent.providerLlm ?? null],
            [ProviderType.TTS, agent.providerTts ?? null],
          ];

    for (const [type, provider] of mappedProviders) {
      if (!provider) {
        continue;
      }
      const containerName = this.buildContainerName(
        agent.id,
        type.toLowerCase(),
      );
      // Generate a random port between 6000 and 6999 for each provider container
      const port = Math.floor(Math.random() * 1000) + 6000;
      const image = this.extractImage(provider);
      const providerEnv = this.extendEnv(env, provider, type, port);
      if (type == ProviderType.STS) {
        coreEnv.push(`STS_URL=ws://${containerName}:${port}`);
      } else {
        coreEnv.push(
          `${type.toLowerCase()}_URL=http://${containerName}:${port}`,
        );
      }
      containerIds[type] = await this.dockerService.runContainer(
        containerName,
        image,
        providerEnv,
        [
          `${process.env.TOOLS_DIR}:/usr/src/app/tools`
        ]
      );
    }

    if (Object.keys(containerIds).length) {
      const containerName = this.buildContainerName(agent.id);
      coreEnv.push(`PORT=${agent.port}`);
      coreEnv.push(`HTTP_PORT=${agent.httpPort}`);
      // Add BACKEND_URL so core container can fetch provider URLs dynamically from database
      const backendUrl = process.env.BACKEND_INTERNAL_URL || process.env.BACKEND_URL || 'http://172.20.0.1:3001';
      coreEnv.push(`BACKEND_URL=${backendUrl}`);
      coreEnv.push(`AGENT_ID=${agent.id}`);
      containerIds['core'] = await this.dockerService.runContainer(
        containerName,
        this.defaultImage,
        coreEnv,
      );
    }

    agent.status = AgentStatus.RUNNING;
    const saved = await this.agentRepository.save(agent);
    
    // Update all numbers linked to this agent to refresh Asterisk dialplan
    if (saved.numbers && saved.numbers.length > 0) {
      for (const number of saved.numbers) {
        try {
          await this.asteriskService.provisionNumber(number);
        } catch (error) {
          this.logger.warn(`Failed to update dialplan for number ${number.value}: ${error.message}`);
        }
      }
    }
    
    return saved;
  }

  async getProviderUrlsForAgent(agentId: string): Promise<{
    stsUrl?: string;
    asrUrl?: string;
    llmUrl?: string;
    ttsUrl?: string;
  }> {
    const agent = await this.findOne(agentId);
    const result: {
      stsUrl?: string;
      asrUrl?: string;
      llmUrl?: string;
      ttsUrl?: string;
    } = {};

    // Get provider container info from agent metadata or discover from Docker
    // For STS mode
    if (agent.mode === AgentMode.STS && agent.providerSts) {
      const containerName = this.buildContainerName(agent.id, ProviderType.STS.toLowerCase());
      const port = await this.getContainerPort(containerName);
      if (port) {
        result.stsUrl = `ws://${containerName}:${port}`;
      }
    } else {
      // For pipeline mode
      if (agent.providerAsr) {
        const containerName = this.buildContainerName(agent.id, ProviderType.ASR.toLowerCase());
        const port = await this.getContainerPort(containerName);
        if (port) {
          result.asrUrl = `http://${containerName}:${port}`;
        }
      }
      if (agent.providerLlm) {
        const containerName = this.buildContainerName(agent.id, ProviderType.LLM.toLowerCase());
        const port = await this.getContainerPort(containerName);
        if (port) {
          result.llmUrl = `http://${containerName}:${port}`;
        }
      }
      if (agent.providerTts) {
        const containerName = this.buildContainerName(agent.id, ProviderType.TTS.toLowerCase());
        const port = await this.getContainerPort(containerName);
        if (port) {
          result.ttsUrl = `http://${containerName}:${port}`;
        }
      }
    }

    return result;
  }

  private async getContainerPort(containerName: string): Promise<number | null> {
    try {
      const containers = await this.dockerService.listContainers(containerName);
      if (containers.length > 0) {
        const inspect = await this.dockerService.getContainerInspect(containers[0].Id);
        const env = inspect.Config?.Env || [];
        const portEnv = env.find((e: string) => e.startsWith('PORT='));
        if (portEnv) {
          return parseInt(portEnv.split('=')[1], 10);
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to get port for container ${containerName}: ${error.message}`);
    }
    return null;
  }

  async stopAgent(id: string): Promise<Agent> {
    const agent = await this.findOne(id);
    const names = this.getContainerNames(agent.id, agent.mode);
    for (const name of names) {
      await this.dockerService.stopContainer(name);
    }

    agent.status = AgentStatus.STOPPED;
    return this.agentRepository.save(agent);
  }

  private async resolveProvider(id?: string | null): Promise<Provider | null> {
    if (!id) {
      return null;
    }

    const provider = await this.providerRepository.findOne({ where: { id } });
    if (!provider) {
      throw new NotFoundException(`Provider ${id} not found`);
    }
    return provider;
  }

  private buildContainerName(agentId: string, type?: string) {
    return type ? `avr-${type}-${agentId}` : `avr-core-${agentId}`;
  }

  private getContainerNames(agentId: string, mode: AgentMode): string[] {
    if (mode === AgentMode.STS) {
      return [
        this.buildContainerName(agentId, ProviderType.STS.toLowerCase()),
        this.buildContainerName(agentId),
      ];
    }

    return [
      this.buildContainerName(agentId, ProviderType.ASR.toLowerCase()),
      this.buildContainerName(agentId, ProviderType.LLM.toLowerCase()),
      this.buildContainerName(agentId, ProviderType.TTS.toLowerCase()),
      this.buildContainerName(agentId),
    ];
  }

  private extractImage(provider: Provider | null): string | null {
    if (!provider) {
      return null;
    }
    let image = provider.config?.image ?? provider.config?.dockerImage;
    if (typeof image === 'string') {
      // Ensure image has a tag (default to :latest if no tag)
      if (!image.includes(':')) {
        image = `${image}:latest`;
      }
      return image;
    }
    return null;
  }

  private buildEnv(agent: Agent, additional: string[]): string[] {
    const baseEnv = [`AGENT_ID=${agent.id}`, `AGENT_NAME=${agent.name}`];

    const envSet = new Set([...baseEnv, ...additional]);
    return Array.from(envSet);
  }

  private isValidUrl(str) {
    try {
      new URL(str);
      return true;
    } catch (_) {
      return false;
    }
  }

  private extendEnv(
    baseEnv: string[],
    provider: Provider,
    type: ProviderType,
    port?: number,
  ): string[] {
    const providerEnv = Object.entries(provider.config?.env ?? {})
      .map(([key, value]) => {
        switch (key) {
          case 'OPENAI_INSTRUCTIONS':
            return `${this.isValidUrl(value) ? 'OPENAI_URL_INSTRUCTIONS' : 'OPENAI_INSTRUCTIONS'}=${value}`;
        case 'OPENAI_LANGUAGE': {
          const language = value ? String(value) : '';
          if (!language || language === 'NULL' || language === 'auto') {
            return null;
          }
          return `OPENAI_LANGUAGE=${language}`;
        }
          case 'GEMINI_INSTRUCTIONS':
            return `${this.isValidUrl(value) ? 'GEMINI_URL_INSTRUCTIONS' : 'GEMINI_INSTRUCTIONS'}=${value}`;
          default:
            return `${key}=${value}`;
        }
      })
      .filter((entry): entry is string => Boolean(entry));
    const env = new Set([...baseEnv, ...providerEnv]);
    env.add(`PROVIDER_${type}_ID=${provider.id}`);
    env.add(`PROVIDER_${type}_NAME=${provider.name}`);
    env.add(`PROVIDER_${type}_TYPE=${provider.type}`);
    env.add(`PORT=${port}`);

    // Add dynamic config loading support
    // PROVIDER_ID and BACKEND_URL enable containers to fetch config from API
    env.add(`PROVIDER_ID=${provider.id}`);
    // Determine backend URL for container-to-backend communication
    // Containers need to reach the host backend - use Docker gateway IP
    let backendUrl = process.env.BACKEND_INTERNAL_URL || process.env.BACKEND_URL;
    if (!backendUrl) {
      // Default: use Docker gateway IP (172.20.0.1 for custom networks, 172.17.0.1 for default bridge)
      // Containers can reach host via gateway IP
      backendUrl = 'http://172.20.0.1:3001'; // Works for containers in Docker network
    }
    // Replace host.docker.internal with gateway IP (doesn't work on Linux)
    if (backendUrl.includes('host.docker.internal')) {
      backendUrl = backendUrl.replace('host.docker.internal', '172.20.0.1');
    }
    env.add(`BACKEND_URL=${backendUrl}`);

    if (type === ProviderType.STS || type === ProviderType.LLM) {
      env.add(`AMI_URL=${process.env.AMI_URL}`);
    }
    return Array.from(env);
  }

  private assertModeRequirements(agent: Agent) {
    if (agent.mode === AgentMode.STS) {
      if (!agent.providerSts) {
        throw new BadRequestException('STS provider is required for STS mode');
      }
      agent.providerAsr = null;
      agent.providerLlm = null;
      agent.providerTts = null;
      return;
    }

    if (!agent.providerAsr || !agent.providerLlm || !agent.providerTts) {
      throw new BadRequestException(
        'Providers ASR, LLM, and TTS are required for pipeline mode',
      );
    }
    agent.providerSts = null;
  }

  private async generateUniqueSipExtension(): Promise<string> {
    const baseExtension = 88000;
    const maxExtension = 88999;

    // Find highest existing extension
    const result = await this.agentRepository
      .createQueryBuilder('agent')
      .select('MAX(CAST(agent.sipExtension AS INTEGER))', 'maxExt')
      .where('agent.sipExtension IS NOT NULL')
      .getRawOne();

    const nextExt = result?.maxExt ? parseInt(result.maxExt, 10) + 1 : baseExtension;

    if (nextExt > maxExtension) {
      throw new BadRequestException('SIP extension pool exhausted (88000-88999)');
    }

    return String(nextExt);
  }

  getVicidialConfig(agent: Agent): VicidialConfigDto {
    const asteriskIp = process.env.ASTERISK_PUBLIC_IP || '127.0.0.1';
    const asteriskPort = process.env.ASTERISK_SIP_PORT || '5060';

    if (!agent.sipExtension) {
      throw new BadRequestException('Agent does not have a SIP extension assigned');
    }

    const sipPeerConfig = `[avr_agent_${agent.sipExtension}]
disallow=all
allow=ulaw
allow=alaw
type=peer
host=${asteriskIp}
port=${asteriskPort}
dtmfmode=rfc2833
canreinvite=no
insecure=port,invite
qualify=yes`;

    const dialplanConfig = `exten => _${agent.sipExtension},1,AGI(agi://127.0.0.1:4577/call_log)
same => n,SIPAddHeader(X-VICIdial-Lead-Id: \${lead_id})
same => n,SIPAddHeader(X-VICIdial-Campaign-Id: \${campaign_id})
same => n,SIPAddHeader(X-VICIdial-Phone-Number: \${phone_number})
same => n,SIPAddHeader(X-VICIdial-User-Id: \${user})
same => n,SIPAddHeader(X-VICIdial-List-Id: \${list_id})
same => n,SIPAddHeader(X-VICIdial-Call-Type: AI_BOT)
same => n,Set(CHANNEL(audioreadformat)=ulaw)
same => n,Set(CHANNEL(audiowriteformat)=ulaw)
same => n,Dial(SIP/${agent.sipExtension}@avr_agent_${agent.sipExtension},120,tTog)
same => n,Hangup()`;

    return {
      agentId: agent.id,
      agentName: agent.name,
      sipExtension: agent.sipExtension,
      asteriskHost: asteriskIp,
      asteriskPort,
      sipPeerConfig,
      dialplanConfig,
    };
  }
}
