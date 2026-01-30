'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpDown, Copy, Download, Eye, MessageSquare, Play, RefreshCcw } from 'lucide-react';
import { apiFetch, ApiError, getApiUrl, getStoredToken, type PaginatedResponse } from '@/lib/api';
import { useAutoRefresh } from '@/hooks/use-auto-refresh';
import { useI18n } from '@/lib/i18n';

// Force dynamic rendering - no caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { TablePagination } from '@/components/ui/pagination';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TranscriptDialog } from '@/components/transcript-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface AgentDto {
  id: string;
  name: string;
  status: string;
}

interface ProviderDto {
  id: string;
  name: string;
  type: string;
}

interface EnhancedCallDto {
  id: string;
  uuid: string;
  agentId?: string | null;
  agentName?: string | null;
  callType?: 'inbound' | 'outbound' | null;
  fromNumber?: string | null;
  toNumber?: string | null;
  providerId?: string | null;
  providerName?: string | null;
  endReason?: string | null;
  cost?: number | null;
  twilioCost?: number | null;
  deepgramCost?: number | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string | null;
  hasRecording?: boolean;
  twilioCallSid?: string | null;
}

// Legacy interface for backward compatibility
interface CallSummaryDto {
  id: string;
  uuid: string;
  agentId?: string | null;
  startedAt: string | null;
  endedAt: string | null;
}

interface CallEventDto {
  id: string;
  type:
    | 'call_initiated'
    | 'call_started'
    | 'call_ended'
    | 'interruption'
    | 'transcription'
    | 'dtmf_digit';
  timestamp: string;
  payload?: Record<string, unknown> | null;
}

interface CallDetailDto extends CallSummaryDto {
  events: CallEventDto[];
}

interface CallInitiatedPayload {
  from?: string;
  to?: string;
  uniqueid?: string;
  channel?: string;
  recording?: boolean;
}

export default function CallsPage() {
  const { dictionary } = useI18n();
  const [calls, setCalls] = useState<EnhancedCallDto[]>([]);
  const [agents, setAgents] = useState<AgentDto[]>([]);
  const [providers, setProviders] = useState<ProviderDto[]>([]);
  const [callInitiatedMap, setCallInitiatedMap] = useState<
    Record<string, CallInitiatedPayload | null>
  >({});
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  });
  const pageSizeOptions = [10, 25, 50, 100];
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedCall, setSelectedCall] = useState<CallDetailDto | null>(null);
  const [audioMap, setAudioMap] = useState<Record<string, string>>({});
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [transcriptCallId, setTranscriptCallId] = useState<string | null>(null);
  const [transcriptCallUuid, setTranscriptCallUuid] = useState<string | null>(null);
  const [playerOpen, setPlayerOpen] = useState(false);
  const [playerCallId, setPlayerCallId] = useState<string | null>(null);
  const [playerCallUuid, setPlayerCallUuid] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    uuid: '',
    startedFrom: '',
    startedTo: '',
    agentId: 'all',
    providerId: 'all',
    callType: 'all' as 'all' | 'inbound' | 'outbound',
    status: 'all' as 'all' | 'in_progress' | 'completed' | 'failed',
    phoneNumber: '',
  });
  const [sort, setSort] = useState<{ field: 'startedAt' | 'endedAt'; direction: 'asc' | 'desc' }>({
    field: 'startedAt',
    direction: 'desc',
  });
  const filtersRef = useRef(filters);

  // Load agents and providers for filter dropdowns
  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        const [agentsRes, providersRes] = await Promise.all([
          apiFetch<PaginatedResponse<AgentDto>>('/agents', {
            query: { page: 1, limit: 100 },
            paginated: true,
          }),
          apiFetch<PaginatedResponse<ProviderDto>>('/providers', {
            query: { page: 1, limit: 100 },
            paginated: true,
          }),
        ]);
        setAgents(agentsRes.data);
        setProviders(providersRes.data);
      } catch (err) {
        console.error('Failed to load filter options:', err);
      }
    };
    void loadFilterOptions();
  }, []);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const extractInitiatedPayload = useCallback((events: CallEventDto[]) => {
    const initiated = events.find((event) => event.type === 'call_initiated');
    if (!initiated?.payload || typeof initiated.payload !== 'object') {
      return null;
    }
    const payload = initiated.payload as Record<string, unknown>;
    const normalized: CallInitiatedPayload = {};
    if (payload.from) {
      normalized.from = String(payload.from);
    }
    if (payload.to) {
      normalized.to = String(payload.to);
    }
    if (payload.uniqueid) {
      normalized.uniqueid = String(payload.uniqueid);
    }
    if (payload.channel) {
      normalized.channel = String(payload.channel);
    }
    if (payload.recording !== undefined) {
      normalized.recording =
        typeof payload.recording === 'boolean'
          ? payload.recording
          : String(payload.recording).toLowerCase() === 'true';
    }
    return Object.keys(normalized).length > 0 ? normalized : null;
  }, []);

  const loadCalls = useCallback(async (overrideFilters?: typeof filters) => {
    setLoading(true);
    try {
      const activeFilters = overrideFilters ?? filtersRef.current;
      const data = await apiFetch<PaginatedResponse<EnhancedCallDto>>('/webhooks/calls-enhanced', {
        query: {
          page: pagination.page,
          limit: pagination.limit,
          uuid: activeFilters.uuid || undefined,
          startedFrom: activeFilters.startedFrom || undefined,
          startedTo: activeFilters.startedTo || undefined,
          agentId: activeFilters.agentId !== 'all' ? activeFilters.agentId : undefined,
          providerId: activeFilters.providerId !== 'all' ? activeFilters.providerId : undefined,
          callType: activeFilters.callType !== 'all' ? activeFilters.callType : undefined,
          status: activeFilters.status !== 'all' ? activeFilters.status : undefined,
          phoneNumber: activeFilters.phoneNumber || undefined,
          sortField: sort.field,
          sortDirection: sort.direction,
        },
        paginated: true,
      });
      setCalls(data.data);
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
        setError(dictionary.calls.errors.loadCalls);
      }
    } finally {
      setLoading(false);
    }
  }, [dictionary.calls.errors.loadCalls, pagination.limit, pagination.page, sort]);

  useEffect(() => {
    loadCalls();
  }, [loadCalls]);

  // Auto-refresh calls every 15 seconds, on focus, and on visibility change
  useAutoRefresh({
    refreshFn: loadCalls,
    intervalMs: 15000,
    refreshOnFocus: true,
    refreshOnVisibility: true,
  });

  useEffect(() => {
    if (calls.length === 0) {
      return;
    }
    const pendingIds = calls
      .map((call) => call.id)
      .filter((id) => !(id in callInitiatedMap));
    if (pendingIds.length === 0) {
      return;
    }
    let active = true;
    const loadInitiated = async () => {
      const results = await Promise.allSettled(
        pendingIds.map(async (id) => {
          const detail = await apiFetch<CallDetailDto>(`/webhooks/calls/${id}`);
          return { id, payload: extractInitiatedPayload(detail.events ?? []) };
        }),
      );
      if (!active) {
        return;
      }
      setCallInitiatedMap((prev) => {
        const next = { ...prev };
        results.forEach((result) => {
          if (result.status === 'fulfilled') {
            next[result.value.id] = result.value.payload;
          }
        });
        return next;
      });
    };
    loadInitiated();
    return () => {
      active = false;
    };
  }, [calls, callInitiatedMap, extractInitiatedPayload]);

  const openDetails = async (callId: string) => {
    setDetailDialogOpen(true);
    setDetailLoading(true);
    try {
      const data = await apiFetch<CallDetailDto>(`/webhooks/calls/${callId}`);
      const next = {
        ...data,
        events: [...(data.events ?? [])].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
        ),
      };
      setSelectedCall(next);
      setCallInitiatedMap((prev) => ({
        ...prev,
        [callId]: extractInitiatedPayload(next.events ?? []),
      }));
    } catch (err) {
      setSelectedCall(null);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(dictionary.calls.errors.loadEvents);
      }
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetails = () => {
    setDetailDialogOpen(false);
    setSelectedCall(null);
  };

  const formatDateTime = useCallback((value: string | null) => {
    if (!value) {
      return '—';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  }, []);

  const formatDuration = useCallback(
    (start: string | null, end: string | null) => {
      if (!start || !end) {
        return dictionary.calls.durationUnknown;
      }
      const startDate = new Date(start);
      const endDate = new Date(end);
      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        return dictionary.calls.durationUnknown;
      }
      const totalSeconds = Math.max(0, Math.floor((endDate.getTime() - startDate.getTime()) / 1000));
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${minutes}m ${seconds}s`;
    },
    [dictionary.calls.durationUnknown],
  );

  const isCompleted = (call: CallSummaryDto) => Boolean(call.startedAt) && Boolean(call.endedAt);
  const selectedInitiatedPayload = useMemo(
    () => (selectedCall ? extractInitiatedPayload(selectedCall.events ?? []) : null),
    [extractInitiatedPayload, selectedCall],
  );
  const toggleSort = useCallback((field: 'startedAt' | 'endedAt') => {
    setSort((prev) => {
      if (prev.field === field) {
        return { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { field, direction: 'desc' };
    });
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);
  const recordingAvailableById = useMemo(() => {
    const map: Record<string, boolean> = {};
    calls.forEach((call) => {
      // Use hasRecording from API response (checks recordings table)
      // Falls back to callInitiatedMap for backward compatibility
      map[call.id] = call.hasRecording ?? Boolean(callInitiatedMap[call.id]?.recording);
    });
    return map;
  }, [callInitiatedMap, calls]);

  const handleDownload = useCallback(
    async (call: EnhancedCallDto) => {
      setDownloadingId(call.id);
      try {
        const token = getStoredToken();
        if (!token) {
          throw new ApiError(dictionary.calls.errors.authRequired, 401);
        }
        const response = await fetch(`${getApiUrl()}/recordings/${call.uuid}/download`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!response.ok) {
          throw new ApiError(await response.text(), response.status);
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${call.uuid}.wav`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError(dictionary.calls.errors.download);
        }
      } finally {
        setDownloadingId(null);
      }
    },
    [dictionary.calls.errors.authRequired, dictionary.calls.errors.download],
  );

  const handlePlay = useCallback(
    async (call: EnhancedCallDto) => {
      // Open the player dialog
      setPlayerCallId(call.id);
      setPlayerCallUuid(call.uuid);
      setPlayerOpen(true);

      // Load audio if not already loaded
      if (audioMap[call.id]) {
        return;
      }
      setLoadingAudioId(call.id);
      try {
        const token = getStoredToken();
        if (!token) {
          throw new ApiError(dictionary.calls.errors.authRequired, 401);
        }
        const response = await fetch(`${getApiUrl()}/recordings/${call.uuid}/download`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!response.ok) {
          throw new ApiError(await response.text(), response.status);
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setAudioMap((prev) => ({ ...prev, [call.id]: url }));
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError(dictionary.calls.errors.play);
        }
      } finally {
        setLoadingAudioId(null);
      }
    },
    [audioMap, dictionary.calls.errors.authRequired, dictionary.calls.errors.play],
  );

  const openTranscript = useCallback((call: EnhancedCallDto) => {
    setTranscriptCallId(call.id);
    setTranscriptCallUuid(call.uuid);
    setTranscriptOpen(true);
  }, []);

  const formatDate = useCallback((value: string | null) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString();
  }, []);

  const formatTime = useCallback((value: string | null) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleTimeString();
  }, []);

  const getEndReasonBadge = useCallback((reason: string | null | undefined, endedAt: string | null | undefined) => {
    // If call hasn't ended yet, show "In Progress"
    if (!endedAt) {
      return (
        <Badge variant="secondary" className="animate-pulse bg-green-500/20 text-green-600">
          {dictionary.calls.endReasons?.in_progress ?? 'In Progress'}
        </Badge>
      );
    }
    if (!reason) return null;
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      completed: 'default',
      abandoned: 'secondary',
      failed: 'destructive',
      no_answer: 'outline',
    };
    return (
      <Badge variant={variants[reason] || 'outline'}>
        {dictionary.calls.endReasons?.[reason as keyof typeof dictionary.calls.endReasons] || reason}
      </Badge>
    );
  }, [dictionary.calls.endReasons]);

  const getCallTypeBadge = useCallback((callType: 'inbound' | 'outbound' | null | undefined) => {
    if (!callType) return '—';
    return (
      <Badge variant={callType === 'inbound' ? 'default' : 'secondary'}>
        {dictionary.calls.filters?.[callType as keyof typeof dictionary.calls.filters] || callType}
      </Badge>
    );
  }, [dictionary.calls.filters]);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{dictionary.calls.title}</h1>
          <p className="text-sm text-muted-foreground">{dictionary.calls.subtitle}</p>
        </div>
        <Button
          variant="outline"
          onClick={() => loadCalls()}
          disabled={loading}
        >
          <RefreshCcw className="mr-2 h-4 w-4" /> {dictionary.calls.buttons.refresh}
        </Button>
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle>{dictionary.calls.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Input
              placeholder={dictionary.calls.filters.uuid ?? 'Call ID'}
              value={filters.uuid}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, uuid: event.target.value }))
              }
            />
            <Input
              placeholder={dictionary.calls.filters.phoneNumber ?? 'Phone Number'}
              value={filters.phoneNumber}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, phoneNumber: event.target.value }))
              }
            />
            <Select
              value={filters.agentId}
              onValueChange={(value) => setFilters((prev) => ({ ...prev, agentId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder={dictionary.calls.filters.agent ?? 'Agent'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{dictionary.calls.filters.allAgents ?? 'All Agents'}</SelectItem>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.providerId}
              onValueChange={(value) => setFilters((prev) => ({ ...prev, providerId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder={dictionary.calls.filters.provider ?? 'Provider'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{dictionary.calls.filters.allProviders ?? 'All Providers'}</SelectItem>
                {providers.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>
                    {provider.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.callType}
              onValueChange={(value) => setFilters((prev) => ({ ...prev, callType: value as typeof filters.callType }))}
            >
              <SelectTrigger>
                <SelectValue placeholder={dictionary.calls.filters.callType ?? 'Call Type'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{dictionary.calls.filters.allTypes ?? 'All Types'}</SelectItem>
                <SelectItem value="inbound">{dictionary.calls.filters.inbound ?? 'Inbound'}</SelectItem>
                <SelectItem value="outbound">{dictionary.calls.filters.outbound ?? 'Outbound'}</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.status}
              onValueChange={(value) => setFilters((prev) => ({ ...prev, status: value as typeof filters.status }))}
            >
              <SelectTrigger>
                <SelectValue placeholder={dictionary.calls.filters.status ?? 'Status'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{dictionary.calls.filters.allStatuses ?? 'All Statuses'}</SelectItem>
                <SelectItem value="in_progress">{dictionary.calls.filters.inProgress ?? 'In Progress'}</SelectItem>
                <SelectItem value="completed">{dictionary.calls.filters.completed ?? 'Completed'}</SelectItem>
                <SelectItem value="failed">{dictionary.calls.filters.failed ?? 'Failed'}</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={filters.startedFrom}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, startedFrom: event.target.value }))
              }
            />
            <Input
              type="date"
              value={filters.startedTo}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, startedTo: event.target.value }))
              }
            />
          </div>
          <div className="mb-6 flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setPagination((prev) => ({ ...prev, page: 1 }));
                loadCalls();
              }}
              disabled={loading}
            >
              {dictionary.calls.filters.apply}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                const cleared = {
                  uuid: '',
                  startedFrom: '',
                  startedTo: '',
                  agentId: 'all',
                  providerId: 'all',
                  callType: 'all' as const,
                  status: 'all' as const,
                  phoneNumber: '',
                };
                setFilters(cleared);
                setPagination((prev) => ({ ...prev, page: 1 }));
                loadCalls(cleared);
              }}
              disabled={loading}
            >
              {dictionary.calls.filters.clear}
            </Button>
          </div>
          {loading ? (
            <CardSkeleton />
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : calls.length === 0 ? (
            <p className="text-sm text-muted-foreground">{dictionary.calls.empty}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleSort('startedAt')}
                        className="h-7 px-2"
                      >
                        {dictionary.calls.table.date ?? 'Date'}
                        <ArrowUpDown className="ml-2 h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead>{dictionary.calls.table.time ?? 'Time'}</TableHead>
                    <TableHead>{dictionary.calls.table.callId ?? 'Call ID'}</TableHead>
                    <TableHead>{dictionary.calls.table.twilioCallSid ?? 'Twilio SID'}</TableHead>
                    <TableHead>{dictionary.calls.table.phoneFrom ?? 'From'}</TableHead>
                    <TableHead>{dictionary.calls.table.phoneTo ?? 'To'}</TableHead>
                    <TableHead>{dictionary.calls.table.agentName ?? 'Agent'}</TableHead>
                    <TableHead>{dictionary.calls.table.callType ?? 'Type'}</TableHead>
                    <TableHead>{dictionary.calls.table.provider ?? 'Provider'}</TableHead>
                    <TableHead>{dictionary.calls.table.duration}</TableHead>
                    <TableHead>{dictionary.calls.table.endReason ?? 'End Reason'}</TableHead>
                    <TableHead>{dictionary.calls.table.cost ?? 'Cost'}</TableHead>
                    <TableHead>{dictionary.calls.table.recording}</TableHead>
                    <TableHead className="text-right">{dictionary.calls.table.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calls.map((call) => (
                    <TableRow key={call.id}>
                      <TableCell className="text-sm">{formatDate(call.startedAt ?? call.createdAt)}</TableCell>
                      <TableCell className="text-sm">{formatTime(call.startedAt ?? call.createdAt)}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1">
                              <span
                                className="max-w-[80px] truncate cursor-pointer hover:text-foreground"
                                onClick={() => navigator.clipboard.writeText(call.uuid)}
                              >
                                {call.uuid.substring(0, 8)}...
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(call.uuid);
                                }}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <p className="font-mono text-xs break-all">{call.uuid}</p>
                            <p className="text-xs text-muted-foreground mt-1">Click to copy</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {call.twilioCallSid ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1">
                                <span
                                  className="max-w-[80px] truncate cursor-pointer hover:text-foreground"
                                  onClick={() => navigator.clipboard.writeText(call.twilioCallSid!)}
                                >
                                  {call.twilioCallSid.substring(0, 12)}...
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 shrink-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(call.twilioCallSid!);
                                  }}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <p className="font-mono text-xs break-all">{call.twilioCallSid}</p>
                              <p className="text-xs text-muted-foreground mt-1">Click to copy</p>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span>—</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        <span
                          className="block max-w-[100px] truncate"
                          title={call.fromNumber ?? '—'}
                        >
                          {call.fromNumber ?? '—'}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        <span
                          className="block max-w-[100px] truncate"
                          title={call.toNumber ?? '—'}
                        >
                          {call.toNumber ?? '—'}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {call.agentName ?? call.agentId ?? '—'}
                      </TableCell>
                      <TableCell>{getCallTypeBadge(call.callType)}</TableCell>
                      <TableCell className="text-sm">
                        {call.providerName ?? '—'}
                      </TableCell>
                      <TableCell className="text-sm">{formatDuration(call.startedAt, call.endedAt)}</TableCell>
                      <TableCell>{getEndReasonBadge(call.endReason, call.endedAt)}</TableCell>
                      <TableCell className="text-sm">
                        {call.cost != null ? (
                          <Tooltip>
                            <TooltipTrigger className="cursor-help underline decoration-dotted underline-offset-4">
                              ${Number(call.cost).toFixed(2)}
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <div className="space-y-1 text-xs">
                                <div className="flex justify-between gap-4">
                                  <span>{dictionary.calls.costBreakdown?.total ?? 'Total'}:</span>
                                  <span className="font-mono">${Number(call.cost).toFixed(4)}</span>
                                </div>
                                <div className="flex justify-between gap-4 text-muted-foreground">
                                  <span>{dictionary.calls.costBreakdown?.deepgram ?? 'Deepgram'}:</span>
                                  <span className="font-mono">${call.deepgramCost != null ? Number(call.deepgramCost).toFixed(4) : '0.0000'}</span>
                                </div>
                                <div className="flex justify-between gap-4 text-muted-foreground">
                                  <span>{dictionary.calls.costBreakdown?.twilio ?? 'Twilio'}:</span>
                                  <span className="font-mono">${call.twilioCost != null ? Number(call.twilioCost).toFixed(4) : '0.0000'}</span>
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell>
                        {recordingAvailableById[call.id] ? (
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handlePlay(call)}
                            disabled={loadingAudioId === call.id}
                            aria-label={dictionary.calls.buttons.listen}
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openTranscript(call)}
                            aria-label={dictionary.calls.transcript?.button ?? 'Transcript'}
                            title={dictionary.calls.transcript?.button ?? 'Transcript'}
                          >
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDetails(call.id)}
                            aria-label={dictionary.calls.buttons.view}
                            title={dictionary.calls.buttons.view}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {recordingAvailableById[call.id] ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDownload(call)}
                              disabled={downloadingId === call.id}
                              aria-label={dictionary.calls.buttons.download}
                              title={dictionary.calls.buttons.download}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          ) : null}
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
                labels={dictionary.pagination}
                pageSizeOptions={pageSizeOptions}
                onPageSizeChange={(limit) =>
                  setPagination((prev) => ({ ...prev, limit, page: 1 }))
                }
                onPageChange={(page) => setPagination((prev) => ({ ...prev, page }))}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={detailDialogOpen} onOpenChange={closeDetails}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{dictionary.calls.title}</DialogTitle>
            <DialogDescription>{selectedCall?.uuid}</DialogDescription>
          </DialogHeader>
          {detailLoading ? (
            <DetailSkeleton />
          ) : selectedCall ? (
            <div className="space-y-4">
              <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-3">
                <div>
                  <span className="font-medium text-foreground">
                    {dictionary.calls.table.startedAt}:
                  </span>{' '}
                  {formatDateTime(selectedCall.startedAt)}
                </div>
                <div>
                  <span className="font-medium text-foreground">
                    {dictionary.calls.table.endedAt}:
                  </span>{' '}
                  {formatDateTime(selectedCall.endedAt)}
                </div>
                <div>
                  <span className="font-medium text-foreground">
                    {dictionary.calls.table.duration}:
                  </span>{' '}
                  {formatDuration(selectedCall.startedAt, selectedCall.endedAt)}
                </div>
                <div>
                  <span className="font-medium text-foreground">
                    {dictionary.calls.table.agentId}:
                  </span>{' '}
                  {selectedCall.agentId ?? dictionary.common.none}
                </div>
                <div>
                  <span className="font-medium text-foreground">
                    {dictionary.calls.table.from}:
                  </span>{' '}
                  {selectedInitiatedPayload?.from ?? dictionary.common.none}
                </div>
                <div>
                  <span className="font-medium text-foreground">
                    {dictionary.calls.table.to}:
                  </span>{' '}
                  {selectedInitiatedPayload?.to ?? dictionary.common.none}
                </div>
                <div>
                  <span className="font-medium text-foreground">
                    {dictionary.calls.table.uniqueid}:
                  </span>{' '}
                  {selectedInitiatedPayload?.uniqueid ?? dictionary.common.none}
                </div>
                <div>
                  <span className="font-medium text-foreground">
                    {dictionary.calls.table.channel}:
                  </span>{' '}
                  {selectedInitiatedPayload?.channel ?? dictionary.common.none}
                </div>
              </div>
              <div className="max-h-[60vh] space-y-3 overflow-auto rounded-md border border-border/60 bg-muted/40 p-4">
                {selectedCall.events.map((event) => (
                  <EventRow key={event.id} event={event} dictionary={dictionary} />
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{dictionary.calls.errors.loadEvents}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeDetails}>
              {dictionary.calls.buttons.close}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TranscriptDialog
        open={transcriptOpen}
        onOpenChange={setTranscriptOpen}
        callId={transcriptCallId}
        callUuid={transcriptCallUuid}
        dictionary={{
          title: dictionary.calls.transcript?.title ?? 'Call Transcript',
          user: dictionary.calls.transcript?.user ?? 'Customer',
          agent: dictionary.calls.transcript?.agent ?? 'Agent',
          empty: dictionary.calls.transcript?.empty ?? 'No transcript available for this call.',
        }}
      />

      <Dialog open={playerOpen} onOpenChange={setPlayerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dictionary.calls.buttons.listen}</DialogTitle>
            <DialogDescription className="font-mono text-xs">
              {playerCallUuid}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-6">
            {playerCallId && loadingAudioId === playerCallId ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                Loading...
              </div>
            ) : playerCallId && audioMap[playerCallId] ? (
              <audio
                controls
                autoPlay
                src={audioMap[playerCallId]}
                className="w-full"
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {dictionary.calls.errors.play}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

function CardSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, idx) => (
        <Skeleton key={idx} className="h-10 w-full" />
      ))}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, idx) => (
        <Skeleton key={idx} className="h-5 w-full" />
      ))}
    </div>
  );
}

interface EventRowProps {
  event: CallEventDto;
  dictionary: ReturnType<typeof useI18n>['dictionary'];
}

function EventRow({ event, dictionary }: EventRowProps) {
  const timestamp = useMemo(() => {
    const date = new Date(event.timestamp);
    return Number.isNaN(date.getTime())
      ? event.timestamp
      : `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  }, [event.timestamp]);

  const renderPayload = () => {
    if (!event.payload) {
      return null;
    }
    if (event.type === 'transcription') {
      const roleRaw = String(event.payload.role ?? 'user');
      const text = String(event.payload.text ?? '');
      const roleLabel =
        roleRaw === 'agent'
          ? dictionary.calls.transcript.agent
          : roleRaw === 'user'
            ? dictionary.calls.transcript.user
            : roleRaw;
      return (
        <div className="space-y-1">
          <div className="text-xs uppercase text-muted-foreground">{roleLabel}</div>
          <p className="rounded bg-background/60 p-3 text-sm">{text}</p>
        </div>
      );
    }
    if (event.type === 'call_initiated') {
      const payload = event.payload as Record<string, unknown>;
      const recordingValue =
        payload.recording === undefined
          ? undefined
          : typeof payload.recording === 'boolean'
            ? payload.recording
            : String(payload.recording).toLowerCase() === 'true';
      return (
        <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
          <div>
            <span className="font-medium text-foreground">
              {dictionary.calls.table.from}:
            </span>{' '}
            <span className="font-mono">{String(payload.from ?? '')}</span>
          </div>
          <div>
            <span className="font-medium text-foreground">
              {dictionary.calls.table.to}:
            </span>{' '}
            <span className="font-mono">{String(payload.to ?? '')}</span>
          </div>
          <div>
            <span className="font-medium text-foreground">
              {dictionary.calls.table.uniqueid}:
            </span>{' '}
            <span className="font-mono">{String(payload.uniqueid ?? '')}</span>
          </div>
          <div>
            <span className="font-medium text-foreground">
              {dictionary.calls.table.channel}:
            </span>{' '}
            <span className="font-mono">{String(payload.channel ?? '')}</span>
          </div>
          <div>
            <span className="font-medium text-foreground">
              {dictionary.calls.table.recording}:
            </span>{' '}
            <span className="font-mono">
              {recordingValue === undefined
                ? '—'
                : recordingValue
                  ? dictionary.common.enabled
                  : dictionary.common.disabled}
            </span>
          </div>
        </div>
      );
    }
    if (event.type === 'dtmf_digit') {
      return (
        <div className="text-sm text-muted-foreground">
          Digit:{' '}
          <span className="font-mono">{String(event.payload.digit ?? '')}</span>
        </div>
      );
    }
    if (event.type === 'interruption') {
      const payload = event.payload as Record<string, unknown>;
      const source = payload?.source ? String(payload.source) : 'user';
      return (
        <div className="text-sm text-amber-600 dark:text-amber-400">
          <span className="font-medium">User interrupted the agent</span>
          {source !== 'user' && (
            <span className="ml-2 text-xs text-muted-foreground">
              (via {source})
            </span>
          )}
        </div>
      );
    }
    if (Object.keys(event.payload).length === 0) {
      return null;
    }
    return (
      <pre className="whitespace-pre-wrap rounded bg-background/60 p-2 text-xs text-muted-foreground">
        {JSON.stringify(event.payload, null, 2)}
      </pre>
    );
  };

  const label = dictionary.calls.events[event.type];

  return (
    <div className="rounded-md border border-border/40 bg-card/40 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-foreground">{label}</span>
        <span className="font-mono text-xs text-muted-foreground">{timestamp}</span>
      </div>
      {renderPayload()}
    </div>
  );
}
