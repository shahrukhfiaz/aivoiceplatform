import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import Ari, { Client } from 'ari-client';
import { Phone } from '../phones/phone.entity';
import { PhoneNumber } from '../numbers/number.entity';
import { Trunk, TrunkDirection } from '../trunks/trunk.entity';

@Injectable()
export class AsteriskService {
  private readonly logger = new Logger(AsteriskService.name);
  private ari: Client | null = null;
  private ariPromise: Promise<Client> | null = null;
  private readonly basePath: string;
  private readonly extensionsPath: string;
  private readonly pjsipPath: string;
  private readonly managerPath: string;
  private readonly trunksPath: string;

  constructor() {
    const envPath = process.env.ASTERISK_CONFIG_PATH || '/app/asterisk';
    // Resolve relative paths relative to backend directory
    if (!path.isAbsolute(envPath)) {
      const backendDir = path.join(__dirname, '../..');
      this.basePath = path.resolve(backendDir, envPath);
      this.logger.debug(`Resolved ASTERISK_CONFIG_PATH: ${envPath} -> ${this.basePath}`);
    } else {
      this.basePath = envPath;
    }
    this.extensionsPath = path.join(this.basePath, 'extensions.conf');
    this.pjsipPath = path.join(this.basePath, 'pjsip.conf');
    this.managerPath = path.join(this.basePath, 'manager.conf');
    this.trunksPath = path.join(this.basePath, 'pjsip.conf');
    this.logger.log(`Asterisk config path: ${this.basePath}`);
  }

  private async getAri(): Promise<Client> {
    if (this.ari) {
      return this.ari;
    }

    if (!this.ariPromise) {
      const url = process.env.ARI_URL || 'http://avr-asterisk:8088/ari';
      const username = process.env.ARI_USERNAME || 'avr';
      const password = process.env.ARI_PASSWORD || 'u4lyvcPyQ19hwJKy';
      this.logger.debug(`Connecting to ARI at ${url}`);
      this.ariPromise = Ari.connect(url, username, password)
        .then((client) => {
          this.ari = client;
          return client;
        })
        .catch((error) => {
          this.logger.error('Failed to connect to ARI', error as Error);
          this.ariPromise = null;
          throw error;
        });
    }

    return this.ariPromise;
  }

  private async reloadModule(moduleName: string): Promise<void> {
    try {
      const ari = await this.getAri();
      await ari.asterisk.reloadModule({ moduleName });
      this.logger.debug(`Reloaded module ${moduleName}`);
    } catch (error) {
      this.logger.error(
        `Unable to reload module ${moduleName}`,
        error as Error,
      );
      // Don't throw - allow phone creation to succeed even if module reload fails
      // The config file is still updated, and Asterisk will pick it up on next reload
      this.logger.warn(
        `Phone provisioning completed but module reload failed. ` +
        `Config file updated. Asterisk will need manual reload or restart.`,
      );
    }
  }

  async provisionPhone(phone: Phone): Promise<void> {
    await this.upsertBlock(
      this.pjsipPath,
      `phone-${phone.id}`,
      this.buildPhoneBlock(phone),
    );
    await this.reloadModule('res_pjsip.so');
  }

  async provisionNumber(number: PhoneNumber): Promise<void> {
    await this.upsertBlock(
      this.extensionsPath,
      `number-${number.id}`,
      this.buildNumberBlock(number),
    );
    await this.reloadModule('pbx_config.so');
  }

  async provisionTrunk(trunk: Trunk): Promise<void> {
    // PJSIP configuration
    await this.upsertBlock(
      this.trunksPath,
      `trunk-${trunk.id}`,
      this.buildTrunkBlock(trunk),
    );

    // For inbound trunks with DID and agent, add inbound dialplan entry
    if (trunk.direction === 'inbound' && trunk.didNumber && trunk.agent) {
      await this.upsertBlock(
        this.extensionsPath,
        `trunk-dialplan-${trunk.id}`,
        this.buildInboundDialplan(trunk),
      );
      await this.reloadModule('pbx_config.so');
    }

    // For outbound trunks, add outbound dialplan context
    if (trunk.direction === 'outbound') {
      await this.upsertBlock(
        this.extensionsPath,
        `trunk-dialplan-${trunk.id}`,
        this.buildOutboundDialplan(trunk),
      );
      await this.reloadModule('pbx_config.so');
    }

    await this.reloadModule('res_pjsip.so');
  }

  async removePhone(phoneId: string): Promise<void> {
    await this.removeBlock(this.pjsipPath, `phone-${phoneId}`);
    await this.reloadModule('res_pjsip.so');
  }

  async removeNumber(numberId: string): Promise<void> {
    await this.removeBlock(this.extensionsPath, `number-${numberId}`);
    await this.reloadModule('pbx_config.so');
  }

  async removeTrunk(trunkId: string, direction?: TrunkDirection): Promise<void> {
    await this.removeBlock(this.trunksPath, `trunk-${trunkId}`);

    // Remove dialplan entry for both inbound and outbound trunks
    if (direction === 'inbound' || direction === 'outbound') {
      await this.removeBlock(this.extensionsPath, `trunk-dialplan-${trunkId}`);
      await this.reloadModule('pbx_config.so');
    }

    await this.reloadModule('res_pjsip.so');
  }

  private async upsertBlock(
    filePath: string,
    identifier: string,
    block: string,
  ) {
    try {
      await this.ensureFile(filePath);
      const content = await fs.readFile(filePath, 'utf8');
      const [beginMarker, endMarker] = this.getMarkers(identifier);
      const blockWithMarkers = `${beginMarker}\n${block}\n${endMarker}\n`;
      const regex = new RegExp(
        `${this.escapeRegex(beginMarker)}[\\s\\S]*?${this.escapeRegex(endMarker)}(?:\\r?\\n|$)`,
        'g',
      );
      let nextContent: string;
      if (regex.test(content)) {
        nextContent = content.replace(regex, blockWithMarkers);
      } else {
        const separator =
          content.length === 0 || content.endsWith('\n') ? '' : '\n';
        nextContent = `${content}${separator}${blockWithMarkers}`;
      }
      await fs.writeFile(filePath, nextContent);
      this.logger.debug(`Updated Asterisk config file: ${filePath} (block: ${identifier})`);
    } catch (error) {
      this.logger.error(
        `Failed to upsert block in ${filePath} for ${identifier}`,
        error as Error,
      );
      throw error;
    }
  }

  private async removeBlock(filePath: string, identifier: string) {
    try {
      await this.ensureFile(filePath);
      const content = await fs.readFile(filePath, 'utf8');
      const [beginMarker, endMarker] = this.getMarkers(identifier);
      const regex = new RegExp(
        `${this.escapeRegex(beginMarker)}[\\s\\S]*?${this.escapeRegex(endMarker)}(?:\\r?\\n|$)`,
        'g',
      );
      const nextContent = content.replace(regex, '');
      await fs.writeFile(
        filePath,
        nextContent.trimEnd() + (nextContent.trimEnd().length ? '\n' : ''),
      );
    } catch (error) {
      this.logger.error(
        `Failed to remove Asterisk block for ${identifier}`,
        error as Error,
      );
    }
  }

  private async ensureFile(filePath: string) {
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      try {
        await fs.access(filePath);
      } catch {
        await fs.writeFile(filePath, '');
      }
    } catch (error) {
      this.logger.error(
        `Failed to ensure file exists: ${filePath}`,
        error as Error,
      );
      throw new Error(
        `Cannot access Asterisk config directory: ${path.dirname(filePath)}. ` +
        `Please ensure ASTERISK_CONFIG_PATH is set correctly and the directory is writable. ` +
        `Error: ${(error as Error).message}`,
      );
    }
  }

  private getMarkers(identifier: string): [string, string] {
    return [`; BEGIN ${identifier}`, `; END ${identifier}`];
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private buildNumberBlock(number: PhoneNumber): string {
    const tenant = process.env.TENANT || 'demo';
    switch (number.application) {
      case 'internal': {
        if (!number.phone) {
          throw new Error('Phone not found for internal call');
        }
        return [
          `[${tenant}]`,
          `exten => ${number.value},1,NoOp(Internal call)`,
          ` same => n,Dial(PJSIP/${number.phone.id})`,
          ' same => n,Hangup()',
        ].join('\n');
      }
      case 'transfer': {
        if (!number.trunk) {
          throw new Error('Trunk not found for transfer call');
        }
        return [
          `[${tenant}]`,
          `exten => ${number.value},1,NoOp(Transfer call)`,
          ` same => n,Dial(PJSIP/${number.value}@${number.trunk.id})`,
          ' same => n,Hangup()',
        ].join('\n');
      }
      case 'agent':
      default: {
        const agent = number.agent;
        if (!agent) {
          throw new Error('Agent not found for number');
        }
        const denoiseEnabled = number.denoiseEnabled ?? true;
        const recordingEnabled = number.recordingEnabled ?? false;
        const lines = [
          `[${tenant}]`,
          `exten => ${number.value},1,NoOp(Exten ${number.value} -> Agent ${agent.name ?? agent.id})`,
          ' same => n,Answer()',
          ' same => n,Ringing()',
          ' same => n,Wait(1)',
          ' same => n,Set(AVR_NUMBER=${CALLERID(num)})',
          " same => n,Set(UUID=${SHELL(uuidgen | tr -d '\\n')})",
          // Capture VICIdial SIP headers if present
          ' same => n,Set(VICIDIAL_LEAD_ID=${PJSIP_HEADER(read,X-VICIdial-Lead-Id)})',
          ' same => n,Set(VICIDIAL_CAMPAIGN_ID=${PJSIP_HEADER(read,X-VICIdial-Campaign-Id)})',
          ' same => n,Set(VICIDIAL_PHONE=${PJSIP_HEADER(read,X-VICIdial-Phone-Number)})',
          ' same => n,Set(VICIDIAL_USER=${PJSIP_HEADER(read,X-VICIdial-User-Id)})',
          ' same => n,Set(VICIDIAL_LIST_ID=${PJSIP_HEADER(read,X-VICIdial-List-Id)})',
          // Build JSON body with VICIdial data included
          " same => n,Set(JSON_BODY={\"uuid\":\"${UUID}\",\"payload\":{\"from\":\"${CALLERID(num)}\",\"to\":\"${EXTEN}\",\"uniqueid\":\"${UNIQUEID}\",\"channel\":\"${CHANNEL}\",\"recording\":" + recordingEnabled + ",\"vicidial\":{\"leadId\":\"${VICIDIAL_LEAD_ID}\",\"campaignId\":\"${VICIDIAL_CAMPAIGN_ID}\",\"phone\":\"${VICIDIAL_PHONE}\",\"userId\":\"${VICIDIAL_USER}\",\"listId\":\"${VICIDIAL_LIST_ID}\"}}})",
          " same => n,Set(CURLOPT(httpheader)=Content-Type: application/json)",
          " same => n,Set(JSON_RESPONSE=${CURL(http://avr-core-" + agent.id + ":" + agent.httpPort + "/call,${JSON_BODY})})",
          " same => n,NoOp(JSON_BODY: ${JSON_BODY})",
          " same => n,NoOp(JSON_RESPONSE: ${JSON_RESPONSE})",
          " same => n,GotoIf($[\"${JSON_RESPONSE}\" = \"\"]?skip_http)",
          " same => n(skip_http),NoOp(HTTP call completed or skipped)",
        ];
        if (recordingEnabled) {
          lines.push(' same => n,MixMonitor(/var/spool/asterisk/monitor/' + tenant+ '/${UUID}.wav)');
        }
        if (denoiseEnabled) {
          lines.push(' same => n,Set(DENOISE(rx)=on)');
        }
        lines.push(
          ' same => n,Dial(AudioSocket/avr-core-' +
            agent.id +
            ':' +
            agent.port +
            '/${UUID})',
          ' same => n,Hangup()',
        );
        return lines.join('\n');
      }
    }
  }

  private buildPhoneBlock(phone: Phone): string {
    const callerName = phone.fullName?.replace(/"/g, '') ?? '';
    const callerId = callerName
      ? `callerid="${callerName}" <${phone.id}>`
      : undefined;

    const endpointSection = [
      `[${phone.id}](webrtc-template)`,
      `auth=${phone.id}`,
      `aors=${phone.id}`,
      `context=${process.env.TENANT || 'demo'}`,
      callerId,
    ].filter(Boolean) as string[];

    const authSection = [
      `[${phone.id}]`,
      'type=auth',
      'auth_type=userpass',
      `username=${phone.id}`,
      `password=${phone.password}`,
    ];

    const aorSection = [
      `[${phone.id}]`,
      'type=aor',
      'max_contacts=1',
      'remove_existing=yes',
    ];

    return [...endpointSection, '', ...authSection, '', ...aorSection].join(
      '\n',
    );
  }

  private buildTrunkBlock(trunk: Trunk): string {
    if (trunk.direction === 'inbound') {
      return this.buildInboundTrunkBlock(trunk);
    } else {
      return this.buildOutboundTrunkBlock(trunk);
    }
  }

  private buildInboundTrunkBlock(trunk: Trunk): string {
    const codecs = this.normalizeCodecs(trunk.codecs);
    const allowedIps = trunk.allowedIps?.split(',').map(ip => ip.trim()).filter(Boolean) || [];

    const sections: string[] = [];

    // Endpoint section - for receiving calls from provider
    const endpointLines = [
      `[${trunk.id}]`,
      'type=endpoint',
      `transport=transport-${trunk.transport || 'udp'}`,
      `context=${process.env.TENANT || 'demo'}`,
      'disallow=all',
      `allow=${codecs}`,
      `aors=${trunk.id}`,
      'direct_media=no',
      'trust_id_inbound=yes',
      'send_pai=yes',
      'send_rpid=yes',
    ];

    sections.push(endpointLines.join('\n'));

    // AOR section
    sections.push([
      `[${trunk.id}]`,
      'type=aor',
      'max_contacts=10',
      'qualify_frequency=60',
    ].join('\n'));

    // Identify section for IP-based matching
    if (allowedIps.length > 0) {
      const identifyLines = [
        `[${trunk.id}]`,
        'type=identify',
        `endpoint=${trunk.id}`,
        ...allowedIps.map(ip => `match=${ip}`),
      ];
      sections.push(identifyLines.join('\n'));
    }

    return sections.join('\n\n');
  }

  private buildOutboundTrunkBlock(trunk: Trunk): string {
    const codecs = this.normalizeCodecs(trunk.codecs);

    if (!trunk.host) {
      throw new Error('Outbound trunk must have a host configured');
    }

    const sections: string[] = [];

    // Endpoint section - for sending calls to provider
    const endpointLines = [
      `[${trunk.id}]`,
      'type=endpoint',
      `transport=transport-${trunk.transport || 'udp'}`,
      `context=${process.env.TENANT || 'demo'}`,
      'disallow=all',
      `allow=${codecs}`,
      `outbound_auth=${trunk.id}`,
      `aors=${trunk.id}`,
      'direct_media=no',
      // NAT traversal options
      'force_rport=yes',
      'rewrite_contact=yes',
      'rtp_symmetric=yes',
      trunk.outboundCallerId ? `from_user=${trunk.outboundCallerId}` : null,
      `from_domain=${trunk.host}`,
      'trust_id_outbound=yes',
      'send_pai=yes',
      'send_rpid=yes',
    ].filter(Boolean) as string[];

    sections.push(endpointLines.join('\n'));

    // Auth section
    sections.push([
      `[${trunk.id}]`,
      'type=auth',
      'auth_type=userpass',
      `username=${trunk.username || trunk.id}`,
      `password=${trunk.password}`,
    ].join('\n'));

    // AOR section - static contact for outbound trunks
    const aorLines = [
      `[${trunk.id}]`,
      'type=aor',
      `contact=sip:${trunk.host}:${trunk.port || 5060}`,
      'max_contacts=1',
      'qualify_frequency=0', // Disable qualify - many carriers don't respond to OPTIONS
    ];
    sections.push(aorLines.join('\n'));

    // Registration section (if enabled)
    if (trunk.registerEnabled) {
      sections.push([
        `[${trunk.id}]`,
        'type=registration',
        `outbound_auth=${trunk.id}`,
        `server_uri=sip:${trunk.host}:${trunk.port || 5060}`,
        `client_uri=sip:${trunk.username || trunk.id}@${trunk.host}`,
        `expiration=${trunk.registerInterval || 120}`,
        'retry_interval=60',
        'max_retries=10',
      ].join('\n'));
    }

    return sections.join('\n\n');
  }

  private buildInboundDialplan(trunk: Trunk): string {
    if (!trunk.agent) {
      throw new Error('Inbound trunk must have an assigned agent');
    }

    const tenant = process.env.TENANT || 'demo';
    const agent = trunk.agent;
    const didNumber = trunk.didNumber || '_X.';

    const lines = [
      `[${tenant}]`,
      `exten => ${didNumber},1,NoOp(Inbound trunk ${trunk.name} -> Agent ${agent.name})`,
      ' same => n,Answer()',
      ' same => n,Ringing()',
      ' same => n,Wait(1)',
      ' same => n,Set(AVR_NUMBER=${CALLERID(num)})',
      " same => n,Set(UUID=${SHELL(uuidgen | tr -d '\\n')})",
      ` same => n,Set(JSON_BODY={"uuid":"\${UUID}","payload":{"from":"\${CALLERID(num)}","to":"${trunk.didNumber}","direction":"inbound","trunkId":"${trunk.id}","trunkName":"${trunk.name}"}})`,
      ' same => n,Set(CURLOPT(httpheader)=Content-Type: application/json)',
      ` same => n,Set(JSON_RESPONSE=\${CURL(http://avr-core-${agent.id}:${agent.httpPort}/call,\${JSON_BODY})})`,
    ];

    if (trunk.recordingEnabled) {
      lines.push(` same => n,MixMonitor(/var/spool/asterisk/monitor/${tenant}/\${UUID}.wav)`);
    }
    if (trunk.denoiseEnabled) {
      lines.push(' same => n,Set(DENOISE(rx)=on)');
    }

    lines.push(
      ` same => n,Dial(AudioSocket/avr-core-${agent.id}:${agent.port}/\${UUID})`,
      ' same => n,Hangup()',
    );

    return lines.join('\n');
  }

  private buildOutboundDialplan(trunk: Trunk): string {
    const tenant = process.env.TENANT || 'demo';
    const callerId = trunk.outboundCallerId || '';

    // Outbound dialplan in the main tenant context
    // This allows any phone in the tenant context to dial out through this trunk
    // Using flexible patterns to match various phone number formats
    const lines = [
      `[${tenant}]`,
      // Pattern for 10-digit numbers (any format)
      `exten => _XXXXXXXXXX,1,NoOp(Outbound call via trunk ${trunk.name} to \${EXTEN})`,
      ' same => n,Set(CALLERID(num)=' + (callerId || '${CALLERID(num)}') + ')',
      ` same => n,Dial(PJSIP/\${EXTEN}@${trunk.id},60,Tt)`,
      ' same => n,Hangup()',
      '',
      // Pattern for 11-digit numbers starting with 1
      `exten => _1XXXXXXXXXX,1,NoOp(Outbound call via trunk ${trunk.name} to \${EXTEN})`,
      ' same => n,Set(CALLERID(num)=' + (callerId || '${CALLERID(num)}') + ')',
      ` same => n,Dial(PJSIP/\${EXTEN}@${trunk.id},60,Tt)`,
      ' same => n,Hangup()',
      '',
      // Pattern for numbers starting with + (international E.164 format)
      `exten => _+X.,1,NoOp(Outbound international call via trunk ${trunk.name} to \${EXTEN})`,
      ' same => n,Set(CALLERID(num)=' + (callerId || '${CALLERID(num)}') + ')',
      ` same => n,Dial(PJSIP/\${EXTEN}@${trunk.id},60,Tt)`,
      ' same => n,Hangup()',
    ];

    return lines.join('\n');
  }

  private normalizeCodecs(input?: string): string {
    const fallback = 'ulaw,alaw';
    if (!input) {
      return fallback;
    }
    const codecs = input
      .split(',')
      .map((codec) => codec.trim())
      .filter(Boolean);

    if (codecs.length === 0) {
      return fallback;
    }

    return codecs.join(',');
  }
}
