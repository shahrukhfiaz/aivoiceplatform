import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { DockerService } from '../docker/docker.service';
import { AsteriskService } from '../asterisk/asterisk.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { CallUpdatesGateway, AgentUpdatePayload } from '../webhooks/call-updates.gateway';
import { Provider, ProviderType } from '../providers/provider.entity';
import { Trunk } from '../trunks/trunk.entity';
import { PhoneNumber } from '../numbers/number.entity';
import { Call } from '../webhooks/call.entity';
import { TwilioNumber } from '../twilio/twilio-number.entity';
import { CreateAgentDto } from './dto/create-agent.dto';
import { DialCallDto } from './dto/dial-call.dto';
import { DialResponseDto } from './dto/dial-response.dto';
import { RunAgentDto } from './dto/run-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { VicidialConfigDto } from './dto/vicidial-config.dto';
import { Agent, AgentCallType, AgentMode, AgentStatus } from './agent.entity';
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
    @InjectRepository(Trunk)
    private readonly trunkRepository: Repository<Trunk>,
    @InjectRepository(PhoneNumber)
    private readonly phoneNumberRepository: Repository<PhoneNumber>,
    @InjectRepository(Call)
    private readonly callRepository: Repository<Call>,
    @InjectRepository(TwilioNumber)
    private readonly twilioNumberRepository: Repository<TwilioNumber>,
    private readonly dockerService: DockerService,
    private readonly asteriskService: AsteriskService,
    @Inject(forwardRef(() => WebhooksService))
    private readonly webhooksService: WebhooksService,
    private readonly callUpdatesGateway: CallUpdatesGateway,
  ) {}

  /**
   * Helper to convert Agent entity to AgentUpdatePayload for SSE broadcasting
   */
  private toAgentUpdatePayload(agent: Agent): AgentUpdatePayload {
    return {
      id: agent.id,
      name: agent.name,
      status: agent.status,
      mode: agent.mode,
    };
  }

  async create(createAgentDto: CreateAgentDto): Promise<Agent> {
    const sipExtension = await this.generateUniqueSipExtension();
    const agent = this.agentRepository.create({
      name: createAgentDto.name,
      mode: createAgentDto.mode ?? AgentMode.PIPELINE,
      defaultCallType: createAgentDto.defaultCallType ?? AgentCallType.INBOUND,
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
    agent.outboundTrunk = await this.resolveTrunk(
      createAgentDto.outboundTrunkId,
    );

    this.assertModeRequirements(agent);

    const saved = await this.agentRepository.save(agent);

    // Broadcast agent created event
    this.callUpdatesGateway.notifyAgentCreated(this.toAgentUpdatePayload(saved));

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

    if (updateAgentDto.defaultCallType !== undefined) {
      agent.defaultCallType = updateAgentDto.defaultCallType;
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
    if (updateAgentDto.outboundTrunkId !== undefined) {
      agent.outboundTrunk = await this.resolveTrunk(
        updateAgentDto.outboundTrunkId,
      );
    }

    this.assertModeRequirements(agent);

    const saved = await this.agentRepository.save(agent);

    // Broadcast agent updated event
    this.callUpdatesGateway.notifyAgentUpdated(this.toAgentUpdatePayload(saved));

    return saved;
  }

  async remove(id: string): Promise<void> {
    const agent = await this.agentRepository.findOne({ where: { id } });
    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    this.logger.log(`Deleting agent ${id}: stopping containers...`);

    // 1. Stop all agent containers first
    const names = this.getContainerNames(agent.id, agent.mode);
    for (const name of names) {
      try {
        await this.dockerService.stopContainer(name);
      } catch (error) {
        this.logger.warn(`Failed to stop container ${name}: ${error.message}`);
      }
    }

    // 2. Unlink phone numbers from this agent (set agent to null)
    this.logger.log(`Deleting agent ${id}: unlinking phone numbers...`);
    await this.phoneNumberRepository.update(
      { agent: { id } },
      { agent: null }
    );

    // 3. Unlink calls from this agent (set agent to null, but keep call history)
    this.logger.log(`Deleting agent ${id}: unlinking calls...`);
    await this.callRepository.update(
      { agent: { id } },
      { agent: null }
    );

    // 4. Unlink trunks from this agent (clear the agent reference on inbound trunks)
    this.logger.log(`Deleting agent ${id}: unlinking trunks...`);
    await this.trunkRepository.update(
      { agent: { id } },
      { agent: null }
    );

    // 5. Unlink Twilio numbers from this agent
    this.logger.log(`Deleting agent ${id}: unlinking Twilio numbers...`);
    await this.twilioNumberRepository.update(
      { agent: { id } },
      { agent: null, agentId: null }
    );

    // 6. Now delete the agent
    this.logger.log(`Deleting agent ${id}: removing from database...`);

    // Save agent info for broadcast before deleting
    const agentPayload = this.toAgentUpdatePayload(agent);

    const result = await this.agentRepository.delete({ id });
    if (!result.affected) {
      throw new NotFoundException('Agent not found');
    }

    // Broadcast agent deleted event
    this.callUpdatesGateway.notifyAgentDeleted(agentPayload);

    this.logger.log(`Agent ${id} deleted successfully`);
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

    // Build webhook URL - use container name for Docker internal networking
    let webhookUrl = process.env.WEBHOOK_URL;
    if (!webhookUrl || webhookUrl.includes('host.docker.internal')) {
      // Default to container name (avr-backend) for reliable Docker internal networking
      webhookUrl = 'http://avr-backend:3001/webhooks';
    }

    const coreEnv = this.buildEnv(agent, [
      `WEBHOOK_URL=${webhookUrl}`,
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
      // Use container name (avr-backend) for reliable Docker internal networking
      const backendUrl = process.env.BACKEND_INTERNAL_URL || process.env.BACKEND_URL || 'http://avr-backend:3001';
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

    // Broadcast agent started event
    this.callUpdatesGateway.notifyAgentStarted(this.toAgentUpdatePayload(saved));

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
      try {
        await this.dockerService.stopContainer(name);
      } catch (error) {
        this.logger.warn(`Failed to stop container ${name}: ${error.message}`);
      }
    }

    agent.status = AgentStatus.STOPPED;
    const saved = await this.agentRepository.save(agent);

    // Broadcast agent stopped event
    this.callUpdatesGateway.notifyAgentStopped(this.toAgentUpdatePayload(saved));

    return saved;
  }

  async dialOutbound(
    agentId: string,
    dto: DialCallDto,
  ): Promise<DialResponseDto> {
    // 1. Validate agent exists
    const agent = await this.findOne(agentId);

    // 2. Validate agent is running
    if (agent.status !== AgentStatus.RUNNING) {
      throw new BadRequestException({
        code: 'AGENT_NOT_RUNNING',
        message: 'Agent must be running to initiate outbound calls',
      });
    }

    // 3. Resolve trunk - use provided trunkId or fall back to agent's default
    let trunk = agent.outboundTrunk;
    if (dto.trunkId) {
      trunk = await this.resolveTrunk(dto.trunkId);
      if (!trunk) {
        throw new BadRequestException({
          code: 'TRUNK_NOT_FOUND',
          message: 'Specified trunk not found or is not an outbound trunk',
        });
      }
    }

    if (!trunk) {
      throw new BadRequestException({
        code: 'NO_OUTBOUND_TRUNK',
        message: 'No outbound trunk specified and agent does not have a default trunk configured',
      });
    }
    const fromNumber = dto.fromNumber || trunk.outboundCallerId || '';
    const uuid = uuidv4();

    // 4. Create call record in database
    const call = await this.webhooksService.createOutboundCall({
      uuid,
      agentId,
      callType: 'outbound',
      toNumber: dto.toNumber,
      fromNumber,
      metadata: dto.metadata,
    });

    // 5. Send dial request to agent container
    try {
      await this.initiateCallViaAgent(agent, {
        uuid,
        toNumber: dto.toNumber,
        fromNumber,
        trunkId: trunk.id,
        timeout: dto.timeout || 60,
        metadata: dto.metadata,
      });
    } catch (error) {
      await this.webhooksService.updateCallStatus(uuid, 'failed', error.message);
      throw new InternalServerErrorException({
        code: 'DIAL_FAILED',
        message: `Failed to initiate call: ${error.message}`,
      });
    }

    return {
      id: call.id,
      uuid: call.uuid,
      status: 'queued',
      agentId,
      toNumber: dto.toNumber,
      fromNumber,
      trunkId: trunk.id,
      trunkName: trunk.name,
      callType: 'outbound',
      createdAt: new Date().toISOString(),
      metadata: dto.metadata,
    };
  }

  private async initiateCallViaAgent(
    agent: Agent,
    params: {
      uuid: string;
      toNumber: string;
      fromNumber: string;
      trunkId: string;
      timeout: number;
      metadata?: Record<string, unknown>;
    },
  ): Promise<void> {
    const coreContainerName = `dsai-core-${agent.id}`;
    const url = `http://${coreContainerName}:${agent.httpPort}/dial`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Agent returned ${response.status}: ${error}`);
    }
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

  private async resolveTrunk(id?: string | null): Promise<Trunk | null> {
    if (!id) {
      return null;
    }

    const trunk = await this.trunkRepository.findOne({
      where: { id, direction: 'outbound' },
    });
    if (!trunk) {
      throw new NotFoundException(`Outbound trunk ${id} not found`);
    }
    return trunk;
  }

  private buildContainerName(agentId: string, type?: string) {
    return type ? `dsai-${type}-${agentId}` : `dsai-core-${agentId}`;
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
    // Use container name (avr-backend) for reliable Docker internal networking
    let backendUrl = process.env.BACKEND_INTERNAL_URL || process.env.BACKEND_URL;
    if (!backendUrl) {
      // Default: use container name for Docker internal networking
      backendUrl = 'http://avr-backend:3001';
    }
    // Replace host.docker.internal with container name (host.docker.internal doesn't work on Linux)
    if (backendUrl.includes('host.docker.internal')) {
      backendUrl = backendUrl.replace('host.docker.internal', 'avr-backend');
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

    const sipPeerConfig = `[agent_${agent.sipExtension}]
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
same => n,Dial(SIP/${agent.sipExtension}@agent_${agent.sipExtension},120,tTog)
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
