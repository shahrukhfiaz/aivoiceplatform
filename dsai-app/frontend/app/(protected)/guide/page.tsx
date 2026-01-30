'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  HelpCircle,
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  Server,
  Bot,
  Shield,
  Hash,
  PhoneCall,
  Download,
  Key,
  Users,
  CheckCircle2,
  Lightbulb,
  AlertCircle,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface GuideSection {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  content: React.ReactNode;
}

function TipBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-md bg-blue-500/10 border border-blue-500/30 p-4 mt-4">
      <Lightbulb className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
      <p className="text-sm text-blue-600 dark:text-blue-400">{children}</p>
    </div>
  );
}

function NoteBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-md bg-yellow-500/10 border border-yellow-500/30 p-4 mt-4">
      <AlertCircle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
      <p className="text-sm text-yellow-600 dark:text-yellow-400">{children}</p>
    </div>
  );
}

function StepList({ steps }: { steps: string[] }) {
  return (
    <ol className="list-none space-y-3 mt-4">
      {steps.map((step, index) => (
        <li key={index} className="flex items-start gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
            {index + 1}
          </span>
          <span className="text-sm text-muted-foreground pt-0.5">{step}</span>
        </li>
      ))}
    </ol>
  );
}

function GuideSectionCard({ section, isOpen, onToggle }: { section: GuideSection; isOpen: boolean; onToggle: () => void }) {
  const Icon = section.icon;

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <Card className="border-border/60">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">{section.title}</CardTitle>
                  <CardDescription className="text-sm">{section.description}</CardDescription>
                </div>
              </div>
              {isOpen ? (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 border-t border-border/60">
            <div className="pt-4 text-sm leading-relaxed">{section.content}</div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export default function GuidePage() {
  const { dictionary: t } = useI18n();
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

  const toggleSection = (id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const guide = t.guide || {};

  const sections: GuideSection[] = [
    {
      id: 'dashboard',
      icon: LayoutDashboard,
      title: guide.sections?.dashboard?.title || 'Dashboard Overview',
      description: guide.sections?.dashboard?.description || 'Monitor call activity and agent performance',
      content: (
        <>
          <p>{guide.sections?.dashboard?.content || 'The Dashboard provides real-time insights into your voice agent operations.'}</p>
          <h4 className="font-medium mt-4 mb-2">{guide.sections?.dashboard?.metricsTitle || 'Key Metrics'}</h4>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>{guide.sections?.dashboard?.metrics?.totalCalls || 'Total Calls - All calls processed by your agents'}</li>
            <li>{guide.sections?.dashboard?.metrics?.activeCalls || 'Active Calls - Currently ongoing conversations'}</li>
            <li>{guide.sections?.dashboard?.metrics?.avgDuration || 'Average Duration - Mean call length across all agents'}</li>
            <li>{guide.sections?.dashboard?.metrics?.successRate || 'Success Rate - Percentage of successfully completed calls'}</li>
          </ul>
          <TipBox>{guide.sections?.dashboard?.tip || 'Use the time range filter to analyze trends over 1, 3, 6, or 12 months.'}</TipBox>
        </>
      ),
    },
    {
      id: 'providers',
      icon: Server,
      title: guide.sections?.providers?.title || 'AI Providers',
      description: guide.sections?.providers?.description || 'Configure speech and language AI services',
      content: (
        <>
          <p>{guide.sections?.providers?.content || 'Providers are the AI services that power your voice agents. Configure them before creating agents.'}</p>
          <h4 className="font-medium mt-4 mb-2">{guide.sections?.providers?.typesTitle || 'Provider Types'}</h4>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li><strong>STS (Speech-to-Speech)</strong> - {guide.sections?.providers?.types?.sts || 'End-to-end voice AI (Deepgram, OpenAI Realtime, Gemini)'}</li>
            <li><strong>ASR</strong> - {guide.sections?.providers?.types?.asr || 'Speech Recognition (converts voice to text)'}</li>
            <li><strong>LLM</strong> - {guide.sections?.providers?.types?.llm || 'Language Model (generates responses)'}</li>
            <li><strong>TTS</strong> - {guide.sections?.providers?.types?.tts || 'Text-to-Speech (converts text to voice)'}</li>
          </ul>
          <h4 className="font-medium mt-4 mb-2">{guide.sections?.providers?.stepsTitle || 'Creating a Provider'}</h4>
          <StepList steps={guide.sections?.providers?.steps || [
            'Navigate to Providers page',
            'Click "New provider"',
            'Select provider type (STS recommended for beginners)',
            'Choose a template (e.g., Deepgram STS)',
            'Enter your API key and configure settings',
            'Click "Create provider"'
          ]} />
          <TipBox>{guide.sections?.providers?.tip || 'STS providers are easiest to set up - they handle speech recognition, AI responses, and voice synthesis in one service.'}</TipBox>
        </>
      ),
    },
    {
      id: 'agents',
      icon: Bot,
      title: guide.sections?.agents?.title || 'Voice Agents',
      description: guide.sections?.agents?.description || 'Create and manage AI voice agents',
      content: (
        <>
          <p>{guide.sections?.agents?.content || 'Agents are your AI-powered voice assistants that handle phone conversations.'}</p>
          <h4 className="font-medium mt-4 mb-2">{guide.sections?.agents?.modesTitle || 'Agent Modes'}</h4>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li><strong>STS Mode</strong> - {guide.sections?.agents?.modes?.sts || 'Uses a single Speech-to-Speech provider (simpler setup)'}</li>
            <li><strong>Pipeline Mode</strong> - {guide.sections?.agents?.modes?.pipeline || 'Combines separate ASR + LLM + TTS providers (more control)'}</li>
          </ul>
          <h4 className="font-medium mt-4 mb-2">{guide.sections?.agents?.stepsTitle || 'Creating an Agent'}</h4>
          <StepList steps={guide.sections?.agents?.steps || [
            'Navigate to Agents page',
            'Click "New agent"',
            'Enter a descriptive name',
            'Select mode (STS or Pipeline)',
            'Choose your configured provider(s)',
            'Select default call type (inbound/outbound)',
            'Optionally assign an outbound trunk',
            'Click "Create agent"'
          ]} />
          <h4 className="font-medium mt-4 mb-2">{guide.sections?.agents?.controlsTitle || 'Agent Controls'}</h4>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li><strong>{guide.sections?.agents?.controls?.run || 'Run'}</strong> - {guide.sections?.agents?.controls?.runDesc || 'Starts the agent container to receive calls'}</li>
            <li><strong>{guide.sections?.agents?.controls?.stop || 'Stop'}</strong> - {guide.sections?.agents?.controls?.stopDesc || 'Stops the agent container'}</li>
            <li><strong>{guide.sections?.agents?.controls?.dial || 'Dial'}</strong> - {guide.sections?.agents?.controls?.dialDesc || 'Initiates an outbound call through this agent'}</li>
          </ul>
          <NoteBox>{guide.sections?.agents?.note || 'An agent must be running to handle calls. Check the status indicator on the Agents page.'}</NoteBox>
        </>
      ),
    },
    {
      id: 'trunks',
      icon: Shield,
      title: guide.sections?.trunks?.title || 'SIP Trunks',
      description: guide.sections?.trunks?.description || 'Connect to phone carriers for calling',
      content: (
        <>
          <p>{guide.sections?.trunks?.content || 'SIP trunks connect your agents to the telephone network through carriers like Telnyx, Twilio, or Vonage.'}</p>
          <h4 className="font-medium mt-4 mb-2">{guide.sections?.trunks?.directionsTitle || 'Trunk Directions'}</h4>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li><strong>{guide.sections?.trunks?.directions?.inbound || 'Inbound'}</strong> - {guide.sections?.trunks?.directions?.inboundDesc || 'Receives calls from external numbers to your agents'}</li>
            <li><strong>{guide.sections?.trunks?.directions?.outbound || 'Outbound'}</strong> - {guide.sections?.trunks?.directions?.outboundDesc || 'Makes calls from your agents to external numbers'}</li>
          </ul>
          <h4 className="font-medium mt-4 mb-2">{guide.sections?.trunks?.inboundTitle || 'Setting Up Inbound Trunk'}</h4>
          <StepList steps={guide.sections?.trunks?.inboundSteps || [
            'Create a new trunk with direction "Inbound"',
            'Enter the DID number your carrier assigned',
            'Select which agent should answer calls',
            'Add allowed IPs from your carrier for security',
            'Configure your carrier to send calls to your server\'s IP'
          ]} />
          <h4 className="font-medium mt-4 mb-2">{guide.sections?.trunks?.outboundTitle || 'Setting Up Outbound Trunk'}</h4>
          <StepList steps={guide.sections?.trunks?.outboundSteps || [
            'Create a new trunk with direction "Outbound"',
            'Enter your carrier\'s SIP host (e.g., sip.telnyx.com)',
            'Enter your SIP credentials (username/password)',
            'Enable registration if your carrier requires it',
            'Set your outbound caller ID'
          ]} />
          <TipBox>{guide.sections?.trunks?.tip || 'Enable "Recording" on trunks to automatically record all calls for quality assurance.'}</TipBox>
        </>
      ),
    },
    {
      id: 'numbers',
      icon: Hash,
      title: guide.sections?.numbers?.title || 'Phone Numbers',
      description: guide.sections?.numbers?.description || 'Route incoming calls to destinations',
      content: (
        <>
          <p>{guide.sections?.numbers?.content || 'Phone numbers define how incoming calls are routed to agents, phones, or other destinations.'}</p>
          <h4 className="font-medium mt-4 mb-2">{guide.sections?.numbers?.applicationsTitle || 'Routing Options'}</h4>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li><strong>{guide.sections?.numbers?.applications?.agent || 'AI Agent'}</strong> - {guide.sections?.numbers?.applications?.agentDesc || 'Route calls to a voice agent'}</li>
            <li><strong>{guide.sections?.numbers?.applications?.internal || 'Internal'}</strong> - {guide.sections?.numbers?.applications?.internalDesc || 'Route to an internal SIP phone'}</li>
            <li><strong>{guide.sections?.numbers?.applications?.transfer || 'Transfer'}</strong> - {guide.sections?.numbers?.applications?.transferDesc || 'Forward to another trunk/destination'}</li>
          </ul>
          <h4 className="font-medium mt-4 mb-2">{guide.sections?.numbers?.stepsTitle || 'Adding a Number'}</h4>
          <StepList steps={guide.sections?.numbers?.steps || [
            'Navigate to Numbers page',
            'Click "New number"',
            'Enter the phone number (with + prefix)',
            'Select the application type',
            'Choose the destination (agent, phone, or trunk)',
            'Enable denoise or recording if needed',
            'Click "Create number"'
          ]} />
        </>
      ),
    },
    {
      id: 'calls',
      icon: PhoneCall,
      title: guide.sections?.calls?.title || 'Making & Managing Calls',
      description: guide.sections?.calls?.description || 'Initiate outbound calls and view history',
      content: (
        <>
          <p>{guide.sections?.calls?.content || 'Monitor all call activity and initiate outbound calls through your agents.'}</p>
          <h4 className="font-medium mt-4 mb-2">{guide.sections?.calls?.outboundTitle || 'Making Outbound Calls'}</h4>
          <StepList steps={guide.sections?.calls?.outboundSteps || [
            'Ensure your agent is running',
            'Click the "Dial" button on the agent',
            'Enter the destination phone number',
            'Optionally set a custom caller ID',
            'Click "Start Call"'
          ]} />
          <h4 className="font-medium mt-4 mb-2">{guide.sections?.calls?.logsTitle || 'Call Logs'}</h4>
          <p className="text-muted-foreground">{guide.sections?.calls?.logsContent || 'The Calls page shows all call history with filters for:'}</p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground mt-2">
            <li>{guide.sections?.calls?.filters?.agent || 'Agent - Filter by specific agent'}</li>
            <li>{guide.sections?.calls?.filters?.type || 'Call Type - Inbound or outbound'}</li>
            <li>{guide.sections?.calls?.filters?.status || 'Status - In progress, completed, failed'}</li>
            <li>{guide.sections?.calls?.filters?.phone || 'Phone Number - Search by caller/destination'}</li>
          </ul>
          <h4 className="font-medium mt-4 mb-2">{guide.sections?.calls?.transcriptTitle || 'Viewing Transcripts'}</h4>
          <p className="text-muted-foreground">{guide.sections?.calls?.transcriptContent || 'Click the "Transcript" button on any call to view the full conversation between the agent and caller.'}</p>
        </>
      ),
    },
    {
      id: 'recordings',
      icon: Download,
      title: guide.sections?.recordings?.title || 'Recordings',
      description: guide.sections?.recordings?.description || 'Access and download call recordings',
      content: (
        <>
          <p>{guide.sections?.recordings?.content || 'Call recordings are stored when recording is enabled on trunks or numbers.'}</p>
          <h4 className="font-medium mt-4 mb-2">{guide.sections?.recordings?.featuresTitle || 'Features'}</h4>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>{guide.sections?.recordings?.features?.listen || 'Listen - Play recordings directly in the browser'}</li>
            <li>{guide.sections?.recordings?.features?.download || 'Download - Save recordings as audio files'}</li>
            <li>{guide.sections?.recordings?.features?.search || 'Search - Find recordings by call UUID'}</li>
          </ul>
          <NoteBox>{guide.sections?.recordings?.note || 'Recordings require storage space. Consider implementing a retention policy for older recordings.'}</NoteBox>
        </>
      ),
    },
    {
      id: 'api',
      icon: Key,
      title: guide.sections?.api?.title || 'API Integration',
      description: guide.sections?.api?.description || 'Programmatic access via API keys',
      content: (
        <>
          <p>{guide.sections?.api?.content || 'Use API keys to integrate with external systems and automate call operations.'}</p>
          <h4 className="font-medium mt-4 mb-2">{guide.sections?.api?.createTitle || 'Creating an API Key'}</h4>
          <StepList steps={guide.sections?.api?.createSteps || [
            'Navigate to API Keys page',
            'Click "Create API Key"',
            'Enter a descriptive name',
            'Select permissions (Read, Write, Admin)',
            'Optionally set an expiration date',
            'Copy and securely store the key (shown only once)'
          ]} />
          <h4 className="font-medium mt-4 mb-2">{guide.sections?.api?.usageTitle || 'Using API Keys'}</h4>
          <p className="text-muted-foreground mb-2">{guide.sections?.api?.usageContent || 'Include your API key in the Authorization header:'}</p>
          <pre className="rounded-md bg-muted p-3 text-sm font-mono overflow-x-auto">
            Authorization: Bearer sk_live_your_api_key
          </pre>
          <TipBox>{guide.sections?.api?.tip || 'Check the API Reference page for complete endpoint documentation and examples.'}</TipBox>
        </>
      ),
    },
    {
      id: 'users',
      icon: Users,
      title: guide.sections?.users?.title || 'User Management',
      description: guide.sections?.users?.description || 'Manage team access and permissions',
      content: (
        <>
          <p>{guide.sections?.users?.content || 'Control who can access your platform and what actions they can perform.'}</p>
          <h4 className="font-medium mt-4 mb-2">{guide.sections?.users?.rolesTitle || 'User Roles'}</h4>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground">
            <li>
              <strong>{guide.sections?.users?.roles?.admin || 'Admin'}</strong> - {guide.sections?.users?.roles?.adminDesc || 'Full access to all features including user management'}
            </li>
            <li>
              <strong>{guide.sections?.users?.roles?.manager || 'Manager'}</strong> - {guide.sections?.users?.roles?.managerDesc || 'Can create/manage agents, providers, make calls'}
            </li>
            <li>
              <strong>{guide.sections?.users?.roles?.viewer || 'Viewer'}</strong> - {guide.sections?.users?.roles?.viewerDesc || 'Read-only access to view data and reports'}
            </li>
          </ul>
          <NoteBox>{guide.sections?.users?.note || 'Only Admin users can create new users or change roles.'}</NoteBox>
        </>
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <HelpCircle className="h-6 w-6" />
          {guide.title || 'User Guide'}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {guide.subtitle || 'Learn how to use the platform effectively'}
        </p>
      </div>

      {/* Quick Start Card */}
      <Card className="border-border/60 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            {guide.quickStart?.title || 'Quick Start Checklist'}
          </CardTitle>
          <CardDescription>
            {guide.quickStart?.description || 'Follow these steps to set up your first voice agent'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="list-none space-y-3">
            {(guide.quickStart?.steps || [
              { step: 'Create a Provider', desc: 'Configure an AI service (e.g., Deepgram STS)' },
              { step: 'Create an Agent', desc: 'Set up a voice agent using your provider' },
              { step: 'Configure a Trunk', desc: 'Connect to your phone carrier' },
              { step: 'Add a Phone Number', desc: 'Route incoming calls to your agent' },
              { step: 'Start the Agent', desc: 'Click "Run" to begin handling calls' },
            ]).map((item: { step: string; desc: string }, index: number) => (
              <li key={index} className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
                  {index + 1}
                </span>
                <div>
                  <span className="font-medium">{item.step}</span>
                  <span className="text-muted-foreground"> — {item.desc}</span>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* Guide Sections */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">{guide.sectionsTitle || 'Detailed Guides'}</h2>
        {sections.map((section) => (
          <GuideSectionCard
            key={section.id}
            section={section}
            isOpen={openSections.has(section.id)}
            onToggle={() => toggleSection(section.id)}
          />
        ))}
      </div>

      {/* Help Footer */}
      <Card className="border-border/60">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
              <HelpCircle className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-medium">{guide.help?.title || 'Need More Help?'}</h3>
              <p className="text-sm text-muted-foreground">
                {guide.help?.description || 'Check the API Reference for technical documentation or contact your administrator.'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
