'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Book, Copy, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { getApiUrl } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface Endpoint {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  description: string;
  request?: Record<string, unknown>;
  response?: Record<string, unknown>;
  queryParams?: { name: string; type: string; description: string; required?: boolean }[];
}

const apiEndpoints: Record<string, Endpoint[]> = {
  agents: [
    {
      method: 'GET',
      path: '/agents',
      description: 'List all agents',
      queryParams: [
        { name: 'page', type: 'number', description: 'Page number', required: false },
        { name: 'limit', type: 'number', description: 'Items per page', required: false },
      ],
      response: {
        data: [
          {
            id: 'uuid',
            name: 'Sales Agent',
            status: 'running',
            providerStsId: 'uuid',
            providerLlmId: 'uuid',
            outboundTrunkId: 'uuid',
            createdAt: '2026-01-26T12:00:00.000Z',
          },
        ],
        page: 1,
        limit: 10,
        total: 100,
      },
    },
    {
      method: 'GET',
      path: '/agents/:id',
      description: 'Get agent details',
      response: {
        id: 'uuid',
        name: 'Sales Agent',
        status: 'running',
        providerStsId: 'uuid',
        providerLlmId: 'uuid',
        outboundTrunkId: 'uuid',
        createdAt: '2026-01-26T12:00:00.000Z',
      },
    },
    {
      method: 'POST',
      path: '/agents',
      description: 'Create a new agent',
      request: {
        name: 'Sales Agent',
        providerStsId: 'uuid',
        providerLlmId: 'uuid',
        outboundTrunkId: 'uuid (optional)',
      },
      response: {
        id: 'uuid',
        name: 'Sales Agent',
        status: 'stopped',
      },
    },
    {
      method: 'PATCH',
      path: '/agents/:id',
      description: 'Update an agent',
      request: {
        name: 'Updated Agent Name',
      },
      response: {
        id: 'uuid',
        name: 'Updated Agent Name',
      },
    },
    {
      method: 'DELETE',
      path: '/agents/:id',
      description: 'Delete an agent',
      response: { success: true },
    },
    {
      method: 'POST',
      path: '/agents/:id/start',
      description: 'Start an agent',
      response: { success: true },
    },
    {
      method: 'POST',
      path: '/agents/:id/stop',
      description: 'Stop an agent',
      response: { success: true },
    },
    {
      method: 'POST',
      path: '/agents/:id/dial',
      description: 'Initiate an outbound call through an agent',
      request: {
        toNumber: '+14155551234',
        fromNumber: '+14155559999 (optional)',
        metadata: { campaign: 'Q1' },
        timeout: 60,
      },
      response: {
        id: 'uuid',
        uuid: 'uuid',
        status: 'queued',
        agentId: 'uuid',
        toNumber: '+14155551234',
        fromNumber: '+14155559999',
        trunkId: 'uuid',
        trunkName: 'Telnyx Outbound',
        callType: 'outbound',
        createdAt: '2026-01-26T12:00:00.000Z',
      },
    },
  ],
  providers: [
    {
      method: 'GET',
      path: '/providers',
      description: 'List all providers',
      response: {
        data: [
          {
            id: 'uuid',
            name: 'Deepgram STS',
            type: 'sts',
            template: 'deepgram',
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/providers/:id',
      description: 'Get provider details',
      response: {
        id: 'uuid',
        name: 'Deepgram STS',
        type: 'sts',
        template: 'deepgram',
      },
    },
    {
      method: 'POST',
      path: '/providers',
      description: 'Create a new provider',
      request: {
        name: 'My Deepgram Provider',
        type: 'sts',
        template: 'deepgram',
        config: {
          env: {
            DEEPGRAM_API_KEY: 'your-api-key',
          },
        },
      },
      response: {
        id: 'uuid',
        name: 'My Deepgram Provider',
        type: 'sts',
      },
    },
    {
      method: 'DELETE',
      path: '/providers/:id',
      description: 'Delete a provider',
      response: { success: true },
    },
  ],
  trunks: [
    {
      method: 'GET',
      path: '/trunks',
      description: 'List all SIP trunks',
      response: {
        data: [
          {
            id: 'uuid',
            name: 'Telnyx Outbound',
            direction: 'outbound',
            host: 'sip.telnyx.com',
            port: 5060,
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/trunks',
      description: 'Create a new SIP trunk',
      request: {
        name: 'Telnyx Outbound',
        direction: 'outbound',
        host: 'sip.telnyx.com',
        port: 5060,
        username: 'your-username',
        password: 'your-password',
        transport: 'udp',
        codecs: 'ulaw,alaw',
      },
      response: {
        id: 'uuid',
        name: 'Telnyx Outbound',
      },
    },
    {
      method: 'DELETE',
      path: '/trunks/:id',
      description: 'Delete a trunk',
      response: { success: true },
    },
  ],
  calls: [
    {
      method: 'GET',
      path: '/webhooks/calls',
      description: 'List call records',
      queryParams: [
        { name: 'page', type: 'number', description: 'Page number', required: false },
        { name: 'limit', type: 'number', description: 'Items per page', required: false },
        { name: 'agentId', type: 'string', description: 'Filter by agent ID', required: false },
        { name: 'callType', type: 'string', description: 'Filter by call type (inbound/outbound)', required: false },
      ],
      response: {
        data: [
          {
            id: 'uuid',
            uuid: 'call-uuid',
            agentId: 'uuid',
            callType: 'outbound',
            fromNumber: '+14155559999',
            toNumber: '+14155551234',
            startedAt: '2026-01-26T12:00:00.000Z',
            endedAt: '2026-01-26T12:05:00.000Z',
            endReason: 'completed',
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/webhooks/calls/:id',
      description: 'Get call details',
      response: {
        id: 'uuid',
        uuid: 'call-uuid',
        agentId: 'uuid',
        callType: 'outbound',
        fromNumber: '+14155559999',
        toNumber: '+14155551234',
        startedAt: '2026-01-26T12:00:00.000Z',
        endedAt: '2026-01-26T12:05:00.000Z',
        endReason: 'completed',
        events: [],
      },
    },
    {
      method: 'GET',
      path: '/webhooks/calls/:id/transcript',
      description: 'Get call transcript',
      response: {
        data: [
          {
            id: 'uuid',
            timestamp: '2026-01-26T12:00:05.000Z',
            role: 'user',
            text: 'Hello, I need help with my account.',
          },
          {
            id: 'uuid',
            timestamp: '2026-01-26T12:00:08.000Z',
            role: 'agent',
            text: "Of course! I'd be happy to help. Can you provide your account number?",
          },
        ],
      },
    },
  ],
  apiKeys: [
    {
      method: 'GET',
      path: '/api-keys',
      description: 'List your API keys',
      response: {
        data: [
          {
            id: 'uuid',
            name: 'Production Key',
            keyPrefix: 'sk_live_xxx',
            key: 'sk_live_xxxxxxxxxxxxxxxxxxxxx',
            scopes: ['read', 'write'],
            createdAt: '2026-01-26T12:00:00.000Z',
            lastUsedAt: '2026-01-26T14:00:00.000Z',
            isActive: true,
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/api-keys',
      description: 'Create a new API key',
      request: {
        name: 'Production Key',
        scopes: ['read', 'write'],
        expiresAt: '2027-01-26T12:00:00.000Z (optional)',
      },
      response: {
        id: 'uuid',
        name: 'Production Key',
        key: 'sk_live_xxxxxxxxxxxxxxxxxxxxx',
        keyPrefix: 'sk_live_xxx',
        scopes: ['read', 'write'],
        createdAt: '2026-01-26T12:00:00.000Z',
        isActive: true,
      },
    },
    {
      method: 'POST',
      path: '/api-keys/:id/revoke',
      description: 'Revoke an API key',
      response: { success: true },
    },
    {
      method: 'DELETE',
      path: '/api-keys/:id',
      description: 'Delete an API key',
      response: { success: true },
    },
  ],
};

const methodColors: Record<string, string> = {
  GET: 'bg-blue-500',
  POST: 'bg-green-500',
  PATCH: 'bg-yellow-500',
  DELETE: 'bg-red-500',
};

function CodeBlock({ code, language = 'json' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative">
      <pre className="rounded-md bg-muted p-4 overflow-x-auto text-sm font-mono">
        <code>{code}</code>
      </pre>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-8 w-8"
        onClick={handleCopy}
      >
        {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  );
}

function EndpointCard({ endpoint, baseUrl }: { endpoint: Endpoint; baseUrl: string }) {
  const [isOpen, setIsOpen] = useState(false);

  const curlExample = `curl -X ${endpoint.method} "${baseUrl}${endpoint.path}" \\
  -H "Authorization: Bearer sk_live_YOUR_API_KEY" \\
  -H "Content-Type: application/json"${
    endpoint.request
      ? ` \\
  -d '${JSON.stringify(endpoint.request, null, 2)}'`
      : ''
  }`;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-border/60">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge className={`${methodColors[endpoint.method]} text-white`}>
                  {endpoint.method}
                </Badge>
                <code className="text-sm font-mono">{endpoint.path}</code>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground hidden sm:inline">
                  {endpoint.description}
                </span>
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
            <CardDescription className="sm:hidden mt-2">{endpoint.description}</CardDescription>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <Tabs defaultValue="curl" className="w-full">
              <TabsList>
                <TabsTrigger value="curl">cURL</TabsTrigger>
                {endpoint.request && <TabsTrigger value="request">Request</TabsTrigger>}
                {endpoint.response && <TabsTrigger value="response">Response</TabsTrigger>}
                {endpoint.queryParams && <TabsTrigger value="params">Parameters</TabsTrigger>}
              </TabsList>
              <TabsContent value="curl" className="mt-4">
                <CodeBlock code={curlExample} />
              </TabsContent>
              {endpoint.request && (
                <TabsContent value="request" className="mt-4">
                  <CodeBlock code={JSON.stringify(endpoint.request, null, 2)} />
                </TabsContent>
              )}
              {endpoint.response && (
                <TabsContent value="response" className="mt-4">
                  <CodeBlock code={JSON.stringify(endpoint.response, null, 2)} />
                </TabsContent>
              )}
              {endpoint.queryParams && (
                <TabsContent value="params" className="mt-4">
                  <div className="rounded-md border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="p-2 text-left font-medium">Parameter</th>
                          <th className="p-2 text-left font-medium">Type</th>
                          <th className="p-2 text-left font-medium">Required</th>
                          <th className="p-2 text-left font-medium">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {endpoint.queryParams.map((param) => (
                          <tr key={param.name} className="border-b last:border-0">
                            <td className="p-2 font-mono">{param.name}</td>
                            <td className="p-2 text-muted-foreground">{param.type}</td>
                            <td className="p-2">
                              <Badge variant={param.required ? 'default' : 'secondary'}>
                                {param.required ? 'Yes' : 'No'}
                              </Badge>
                            </td>
                            <td className="p-2 text-muted-foreground">{param.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>
              )}
            </Tabs>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export default function ApiReferencePage() {
  const { dictionary: t } = useI18n();
  const baseUrl = getApiUrl();

  const sections = [
    { key: 'authentication', label: t.apiReference?.sections?.authentication || 'Authentication' },
    { key: 'agents', label: t.apiReference?.sections?.agents || 'Agents' },
    { key: 'providers', label: t.apiReference?.sections?.providers || 'Providers' },
    { key: 'trunks', label: t.apiReference?.sections?.trunks || 'Trunks' },
    { key: 'calls', label: t.apiReference?.sections?.calls || 'Calls' },
    { key: 'apiKeys', label: t.apiReference?.sections?.apiKeys || 'API Keys' },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Book className="h-6 w-6" />
          {t.apiReference?.title || 'API Reference'}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t.apiReference?.description || 'Complete API documentation with examples'}
        </p>
      </div>

      {/* Authentication Section */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle>{t.apiReference?.authentication?.title || 'Authentication'}</CardTitle>
          <CardDescription>
            {t.apiReference?.authentication?.description || 'All API requests require authentication using an API key or JWT token'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">
            {t.apiReference?.authentication?.example || 'Include your API key in the Authorization header:'}
          </p>
          <CodeBlock
            code={`Authorization: Bearer sk_live_YOUR_API_KEY`}
          />
          <div className="rounded-md bg-blue-500/10 border border-blue-500/30 p-4">
            <p className="text-sm text-blue-600 dark:text-blue-400">
              <strong>Tip:</strong> Create API keys in the{' '}
              <a href="/api-keys" className="underline">
                API Keys
              </a>{' '}
              section. Keys starting with <code className="bg-muted px-1 rounded">sk_live_</code> are for production use.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Base URL */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle>{t.apiReference?.baseUrl?.title || 'Base URL'}</CardTitle>
        </CardHeader>
        <CardContent>
          <CodeBlock code={baseUrl} />
        </CardContent>
      </Card>

      {/* Agents Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">{t.apiReference?.sections?.agents || 'Agents'}</h2>
        <p className="text-sm text-muted-foreground">
          Manage voice agents, start/stop them, and initiate outbound calls.
        </p>
        {apiEndpoints.agents.map((endpoint, idx) => (
          <EndpointCard key={idx} endpoint={endpoint} baseUrl={baseUrl} />
        ))}
      </div>

      {/* Providers Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">{t.apiReference?.sections?.providers || 'Providers'}</h2>
        <p className="text-sm text-muted-foreground">
          Configure STS (Speech-to-Speech) and LLM providers for your agents.
        </p>
        {apiEndpoints.providers.map((endpoint, idx) => (
          <EndpointCard key={idx} endpoint={endpoint} baseUrl={baseUrl} />
        ))}
      </div>

      {/* Trunks Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">{t.apiReference?.sections?.trunks || 'SIP Trunks'}</h2>
        <p className="text-sm text-muted-foreground">
          Manage SIP trunks for inbound and outbound calling.
        </p>
        {apiEndpoints.trunks.map((endpoint, idx) => (
          <EndpointCard key={idx} endpoint={endpoint} baseUrl={baseUrl} />
        ))}
      </div>

      {/* Calls Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">{t.apiReference?.sections?.calls || 'Calls'}</h2>
        <p className="text-sm text-muted-foreground">
          View call logs, transcripts, and call details.
        </p>
        {apiEndpoints.calls.map((endpoint, idx) => (
          <EndpointCard key={idx} endpoint={endpoint} baseUrl={baseUrl} />
        ))}
      </div>

      {/* API Keys Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">{t.apiReference?.sections?.apiKeys || 'API Keys'}</h2>
        <p className="text-sm text-muted-foreground">
          Manage API keys for programmatic access.
        </p>
        {apiEndpoints.apiKeys.map((endpoint, idx) => (
          <EndpointCard key={idx} endpoint={endpoint} baseUrl={baseUrl} />
        ))}
      </div>

      {/* Error Responses */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle>{t.apiReference?.errors?.title || 'Error Responses'}</CardTitle>
          <CardDescription>
            {t.apiReference?.errors?.description || 'All API errors follow this format'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <CodeBlock
            code={JSON.stringify(
              {
                statusCode: 400,
                message: 'Validation failed',
                error: 'Bad Request',
              },
              null,
              2
            )}
          />
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-2 text-left font-medium">Status Code</th>
                  <th className="p-2 text-left font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="p-2 font-mono">400</td>
                  <td className="p-2 text-muted-foreground">Bad Request - Invalid input</td>
                </tr>
                <tr className="border-b">
                  <td className="p-2 font-mono">401</td>
                  <td className="p-2 text-muted-foreground">Unauthorized - Invalid or missing API key</td>
                </tr>
                <tr className="border-b">
                  <td className="p-2 font-mono">403</td>
                  <td className="p-2 text-muted-foreground">Forbidden - Insufficient permissions</td>
                </tr>
                <tr className="border-b">
                  <td className="p-2 font-mono">404</td>
                  <td className="p-2 text-muted-foreground">Not Found - Resource does not exist</td>
                </tr>
                <tr>
                  <td className="p-2 font-mono">500</td>
                  <td className="p-2 text-muted-foreground">Internal Server Error</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
