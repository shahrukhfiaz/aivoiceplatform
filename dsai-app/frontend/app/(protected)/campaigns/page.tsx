'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  PlusCircle,
  Pencil,
  Trash2,
  Play,
  Pause,
  Square,
  Target,
  Users,
  Phone,
  Clock,
  Volume2,
  Shield,
} from 'lucide-react';
import { apiFetch, ApiError, type PaginatedResponse } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useCallUpdates, type DataChangePayload } from '@/hooks/use-call-updates';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TablePagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';

const callingHoursSchema = z.object({
  timezone: z.string(),
  weekday: z.object({ start: z.string(), end: z.string() }),
  saturday: z.object({ start: z.string(), end: z.string() }).nullable(),
  sunday: z.object({ start: z.string(), end: z.string() }).nullable(),
}).nullable().optional();

const amdSettingsSchema = z.object({
  initialSilence: z.number().optional(),
  greeting: z.number().optional(),
  afterGreetingSilence: z.number().optional(),
  totalAnalysisTime: z.number().optional(),
  minWordLength: z.number().optional(),
  betweenWordsSilence: z.number().optional(),
  maximumWordLength: z.number().optional(),
  silenceThreshold: z.number().optional(),
}).nullable().optional();

const campaignSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  description: z.string().optional(),
  dialingMode: z.enum(['predictive', 'progressive', 'preview', 'power']),
  aiAgentId: z.string().optional(),
  outboundTrunkId: z.string().optional(),
  callsPerAgent: z.number().min(1).max(10),
  maxAbandonRate: z.number().min(1).max(10),
  ringTimeout: z.number().min(10).max(120),
  wrapUpTime: z.number().min(0).max(300),
  maxAttemptsPerLead: z.number().min(1).max(10),
  defaultCallerId: z.string().optional(),
  script: z.string().optional(),
  // Calling hours (TCPA compliance)
  callingHours: callingHoursSchema,
  respectStateRules: z.boolean().optional(),
  // AMD settings
  amdEnabled: z.boolean().optional(),
  amdMode: z.enum(['fast', 'balanced', 'accurate']).optional(),
  amdSettings: amdSettingsSchema,
  voicemailDropEnabled: z.boolean().optional(),
  voicemailDropRecordingId: z.string().optional(),
});

type CampaignFormValues = z.infer<typeof campaignSchema>;

interface AgentDto {
  id: string;
  name: string;
  status: string;
}

interface TrunkDto {
  id: string;
  name: string;
  direction: string;
}

interface CallingHours {
  timezone: string;
  weekday: { start: string; end: string };
  saturday: { start: string; end: string } | null;
  sunday: { start: string; end: string } | null;
}

interface AmdSettings {
  initialSilence?: number;
  greeting?: number;
  afterGreetingSilence?: number;
  totalAnalysisTime?: number;
  minWordLength?: number;
  betweenWordsSilence?: number;
  maximumWordLength?: number;
  silenceThreshold?: number;
}

interface CampaignDto {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'paused' | 'completed' | 'archived';
  dialingMode: 'predictive' | 'progressive' | 'preview' | 'power';
  aiAgent?: AgentDto;
  aiAgentId?: string;
  outboundTrunk?: TrunkDto;
  outboundTrunkId?: string;
  callsPerAgent: number;
  maxAbandonRate: number;
  ringTimeout: number;
  wrapUpTime: number;
  maxAttemptsPerLead: number;
  defaultCallerId?: string;
  script?: string;
  // Calling hours
  callingHours?: CallingHours | null;
  respectStateRules?: boolean;
  // AMD
  amdEnabled?: boolean;
  amdMode?: 'fast' | 'balanced' | 'accurate';
  amdSettings?: AmdSettings | null;
  voicemailDropEnabled?: boolean;
  voicemailDropRecordingId?: string;
  // Stats
  totalLeads?: number;
  dialedLeads?: number;
  contactedLeads?: number;
  createdAt: string;
  updatedAt: string;
}

const statusColors: Record<CampaignDto['status'], string> = {
  active: 'bg-green-500',
  paused: 'bg-yellow-500',
  completed: 'bg-blue-500',
  archived: 'bg-gray-500',
};

export default function CampaignsPage() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<CampaignDto[]>([]);
  const [agents, setAgents] = useState<AgentDto[]>([]);
  const [trunks, setTrunks] = useState<TrunkDto[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<CampaignDto | null>(null);
  const [updating, setUpdating] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CampaignDto | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const isReadOnly = user?.role === 'viewer';

  const defaultFormValues: CampaignFormValues = {
    name: '',
    description: '',
    dialingMode: 'predictive',
    aiAgentId: '',
    outboundTrunkId: '',
    callsPerAgent: 1.5,
    maxAbandonRate: 3,
    ringTimeout: 30,
    wrapUpTime: 30,
    maxAttemptsPerLead: 3,
    defaultCallerId: '',
    script: '',
    // Calling hours defaults
    callingHours: null,
    respectStateRules: true,
    // AMD defaults
    amdEnabled: false,
    amdMode: 'balanced',
    amdSettings: null,
    voicemailDropEnabled: true,
    voicemailDropRecordingId: '',
  };

  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignSchema),
    defaultValues: defaultFormValues,
  });

  const editForm = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignSchema),
    defaultValues: defaultFormValues,
  });

  const loadAgents = useCallback(async () => {
    try {
      const data = await apiFetch<PaginatedResponse<AgentDto>>('/agents', {
        query: { limit: 100 },
        paginated: true,
      });
      setAgents(data.data);
    } catch (err) {
      console.error('Failed to load agents:', err);
    }
  }, []);

  const loadTrunks = useCallback(async () => {
    try {
      const data = await apiFetch<PaginatedResponse<TrunkDto>>('/trunks', {
        query: { limit: 100 },
        paginated: true,
      });
      setTrunks(data.data.filter((t) => t.direction === 'outbound'));
    } catch (err) {
      console.error('Failed to load trunks:', err);
    }
  }, []);

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<PaginatedResponse<CampaignDto>>('/campaigns', {
        query: { page: pagination.page, limit: pagination.limit },
        paginated: true,
      });
      setCampaigns(data.data);
      setPagination({
        page: data.page,
        limit: data.limit,
        total: data.total,
        hasNextPage: data.hasNextPage,
        hasPreviousPage: data.hasPreviousPage,
      });
      setError(null);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to load campaigns');
      }
    } finally {
      setLoading(false);
    }
  }, [pagination.limit, pagination.page]);

  useEffect(() => {
    loadCampaigns();
    loadAgents();
    loadTrunks();
  }, [loadCampaigns, loadAgents, loadTrunks]);

  useCallUpdates({
    onDataChanged: useCallback((payload: DataChangePayload) => {
      if (payload.entity === 'campaign') {
        loadCampaigns();
      }
    }, [loadCampaigns]),
  });

  const onSubmit = async (values: CampaignFormValues) => {
    if (isReadOnly) return;
    setSubmitting(true);
    try {
      await apiFetch<CampaignDto>('/campaigns', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      setDialogOpen(false);
      form.reset(defaultFormValues);
      await loadCampaigns();
    } catch (err) {
      if (err instanceof ApiError) {
        form.setError('name', { message: err.message });
      } else if (err instanceof Error) {
        setError(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const openEditDialog = (campaign: CampaignDto) => {
    if (isReadOnly) return;
    setEditingCampaign(campaign);
    editForm.reset({
      name: campaign.name,
      description: campaign.description || '',
      dialingMode: campaign.dialingMode,
      aiAgentId: campaign.aiAgentId || '',
      outboundTrunkId: campaign.outboundTrunkId || '',
      callsPerAgent: campaign.callsPerAgent,
      maxAbandonRate: campaign.maxAbandonRate,
      ringTimeout: campaign.ringTimeout,
      wrapUpTime: campaign.wrapUpTime,
      maxAttemptsPerLead: campaign.maxAttemptsPerLead,
      defaultCallerId: campaign.defaultCallerId || '',
      script: campaign.script || '',
      // Calling hours
      callingHours: campaign.callingHours || null,
      respectStateRules: campaign.respectStateRules ?? true,
      // AMD
      amdEnabled: campaign.amdEnabled ?? false,
      amdMode: campaign.amdMode || 'balanced',
      amdSettings: campaign.amdSettings || null,
      voicemailDropEnabled: campaign.voicemailDropEnabled ?? true,
      voicemailDropRecordingId: campaign.voicemailDropRecordingId || '',
    });
    setEditDialogOpen(true);
  };

  const handleUpdate = async (values: CampaignFormValues) => {
    if (!editingCampaign || isReadOnly) return;
    setUpdating(true);
    try {
      await apiFetch<CampaignDto>(`/campaigns/${editingCampaign.id}`, {
        method: 'PATCH',
        body: JSON.stringify(values),
      });
      setEditDialogOpen(false);
      setEditingCampaign(null);
      await loadCampaigns();
    } catch (err) {
      if (err instanceof ApiError) {
        editForm.setError('name', { message: err.message });
      }
    } finally {
      setUpdating(false);
    }
  };

  const handleCampaignAction = async (id: string, action: 'start' | 'pause' | 'stop') => {
    if (isReadOnly) return;
    setActionLoading(id);
    try {
      await apiFetch(`/campaigns/${id}/${action}`, { method: 'POST' });
      await loadCampaigns();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      }
    } finally {
      setActionLoading(null);
    }
  };

  const confirmDelete = (campaign: CampaignDto) => {
    if (isReadOnly) return;
    setDeleteTarget(campaign);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget || isReadOnly) return;
    setDeleting(true);
    try {
      await apiFetch(`/campaigns/${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      setDeleteDialogOpen(false);
      await loadCampaigns();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      }
    } finally {
      setDeleting(false);
    }
  };

  const renderFormFields = (formInstance: typeof form) => (
    <>
      <FormField
        control={formInstance.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Campaign Name</FormLabel>
            <FormControl>
              <Input placeholder="e.g., Q1 Sales Campaign" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={formInstance.control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Description</FormLabel>
            <FormControl>
              <Textarea placeholder="Campaign description..." {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={formInstance.control}
          name="dialingMode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Dialing Mode</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select mode" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="predictive">Predictive</SelectItem>
                  <SelectItem value="progressive">Progressive</SelectItem>
                  <SelectItem value="preview">Preview</SelectItem>
                  <SelectItem value="power">Power</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={formInstance.control}
          name="callsPerAgent"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Calls Per Agent</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.1"
                  {...field}
                  onChange={(e) => field.onChange(parseFloat(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={formInstance.control}
          name="aiAgentId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>AI Agent</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || ''}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select agent" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name} {agent.status === 'running' && '(Running)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={formInstance.control}
          name="outboundTrunkId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Outbound Trunk</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || ''}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select trunk" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {trunks.map((trunk) => (
                    <SelectItem key={trunk.id} value={trunk.id}>
                      {trunk.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <FormField
          control={formInstance.control}
          name="ringTimeout"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ring Timeout (s)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  {...field}
                  onChange={(e) => field.onChange(parseInt(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={formInstance.control}
          name="wrapUpTime"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Wrap-up Time (s)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  {...field}
                  onChange={(e) => field.onChange(parseInt(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={formInstance.control}
          name="maxAttemptsPerLead"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Max Attempts</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  {...field}
                  onChange={(e) => field.onChange(parseInt(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={formInstance.control}
        name="defaultCallerId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Default Caller ID</FormLabel>
            <FormControl>
              <Input placeholder="+1XXXXXXXXXX" {...field} />
            </FormControl>
            <FormDescription>Phone number shown to leads</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={formInstance.control}
        name="script"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Agent Script</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Script for the AI agent..."
                className="min-h-[100px]"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Calling Hours Section */}
      <div className="rounded-lg border p-4 space-y-4">
        <div className="flex items-center gap-2 font-medium">
          <Clock className="h-4 w-4" />
          Calling Hours (TCPA Compliance)
        </div>

        <FormField
          control={formInstance.control}
          name="respectStateRules"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <FormLabel>Respect State Rules</FormLabel>
                <FormDescription>
                  Automatically apply state-specific calling hour restrictions (TCPA)
                </FormDescription>
              </div>
              <FormControl>
                <Switch checked={field.value ?? true} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="text-xs text-muted-foreground">
          Default: 8am-9pm local time (federal TCPA minimum). State-specific rules may be stricter.
        </div>
      </div>

      {/* AMD Section */}
      <div className="rounded-lg border p-4 space-y-4">
        <div className="flex items-center gap-2 font-medium">
          <Volume2 className="h-4 w-4" />
          Answering Machine Detection (AMD)
        </div>

        <FormField
          control={formInstance.control}
          name="amdEnabled"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <FormLabel>Enable AMD</FormLabel>
                <FormDescription>
                  Detect answering machines before connecting to agent
                </FormDescription>
              </div>
              <FormControl>
                <Switch checked={field.value ?? false} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={formInstance.control}
          name="amdMode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Detection Mode</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || 'balanced'}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select mode" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="fast">Fast (&lt;3s, ~75% accuracy)</SelectItem>
                  <SelectItem value="balanced">Balanced (3-5s, ~85% accuracy)</SelectItem>
                  <SelectItem value="accurate">Accurate (5-8s, ~95% accuracy)</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                Trade-off between speed and accuracy
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={formInstance.control}
          name="voicemailDropEnabled"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <FormLabel>Enable Voicemail Drop</FormLabel>
                <FormDescription>
                  Leave a pre-recorded message when machine is detected
                </FormDescription>
              </div>
              <FormControl>
                <Switch checked={field.value ?? true} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />
      </div>
    </>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
          <p className="text-sm text-muted-foreground">
            Manage your outbound dialing campaigns
          </p>
        </div>
        {!isReadOnly && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" /> New Campaign
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Campaign</DialogTitle>
                <DialogDescription>
                  Set up a new outbound dialing campaign
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
                  {renderFormFields(form)}
                  <DialogFooter>
                    <Button type="submit" disabled={submitting}>
                      {submitting ? 'Creating...' : 'Create Campaign'}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            All Campaigns
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, idx) => (
                <Skeleton key={idx} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No campaigns yet</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Leads</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((campaign) => (
                    <TableRow key={campaign.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{campaign.name}</div>
                          {campaign.description && (
                            <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {campaign.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`${statusColors[campaign.status]} text-white`}
                        >
                          {campaign.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="capitalize">{campaign.dialingMode}</TableCell>
                      <TableCell>
                        {campaign.aiAgent?.name || (
                          <span className="text-muted-foreground">Not assigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Users className="h-3 w-3" />
                          {campaign.totalLeads || 0}
                          {campaign.contactedLeads !== undefined && (
                            <span className="text-muted-foreground">
                              ({campaign.contactedLeads} contacted)
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {campaign.status === 'paused' && (
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleCampaignAction(campaign.id, 'start')}
                              disabled={isReadOnly || actionLoading === campaign.id}
                              title="Start"
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                          )}
                          {campaign.status === 'active' && (
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleCampaignAction(campaign.id, 'pause')}
                              disabled={isReadOnly || actionLoading === campaign.id}
                              title="Pause"
                            >
                              <Pause className="h-4 w-4" />
                            </Button>
                          )}
                          {(campaign.status === 'active' || campaign.status === 'paused') && (
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleCampaignAction(campaign.id, 'stop')}
                              disabled={isReadOnly || actionLoading === campaign.id}
                              title="Stop"
                            >
                              <Square className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => openEditDialog(campaign)}
                            disabled={isReadOnly}
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => confirmDelete(campaign)}
                            disabled={isReadOnly || campaign.status === 'active'}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination
                page={pagination.page}
                limit={pagination.limit}
                total={pagination.total}
                hasNextPage={pagination.hasNextPage}
                hasPreviousPage={pagination.hasPreviousPage}
                labels={{
                  range: 'Showing {start}-{end} of {total} campaigns',
                  zero: '0 campaigns',
                  of: 'of',
                  prev: 'Previous',
                  next: 'Next',
                  perPage: 'per page',
                }}
                pageSizeOptions={[10, 25, 50]}
                onPageSizeChange={(limit) =>
                  setPagination((prev) => ({ ...prev, limit, page: 1 }))
                }
                onPageChange={(page) =>
                  setPagination((prev) => ({ ...prev, page }))
                }
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Campaign</DialogTitle>
            <DialogDescription>Update campaign settings</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form className="space-y-4" onSubmit={editForm.handleSubmit(handleUpdate)}>
              {renderFormFields(editForm)}
              <DialogFooter>
                <Button type="submit" disabled={updating}>
                  {updating ? 'Saving...' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;? This will also delete all associated lists and leads.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
