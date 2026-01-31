'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CalendarClock,
  Phone,
  User,
  Clock,
  Target,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { apiFetch, type PaginatedResponse } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TablePagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface LeadDto {
  id: string;
  phoneNumber: string;
  firstName?: string | null;
  lastName?: string | null;
  status: string;
  callbackScheduledAt?: string | null;
  callbackAgentId?: string | null;
  callbackType?: string | null;
  callbackNotes?: string | null;
  dialAttempts: number;
  lastDialedAt?: string | null;
  list?: {
    id: string;
    name: string;
    campaign?: {
      id: string;
      name: string;
    };
  };
}

interface CampaignDto {
  id: string;
  name: string;
}

interface AgentDto {
  id: string;
  name: string;
}

export default function CallbacksPage() {
  const { user } = useAuth();
  const [callbacks, setCallbacks] = useState<LeadDto[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignDto[]>([]);
  const [agents, setAgents] = useState<AgentDto[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterCampaign, setFilterCampaign] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [stats, setStats] = useState({
    pending: 0,
    overdue: 0,
    completedToday: 0,
  });

  const loadCampaigns = useCallback(async () => {
    try {
      const data = await apiFetch<PaginatedResponse<CampaignDto>>('/campaigns', {
        query: { limit: 100 },
        paginated: true,
      });
      setCampaigns(data.data);
    } catch {
      // Silent fail
    }
  }, []);

  const loadAgents = useCallback(async () => {
    try {
      const data = await apiFetch<PaginatedResponse<AgentDto>>('/agents', {
        query: { limit: 100 },
        paginated: true,
      });
      setAgents(data.data);
    } catch {
      // Silent fail
    }
  }, []);

  const loadCallbacks = useCallback(async () => {
    setLoading(true);
    try {
      // For now, we'll fetch leads with callback status
      // In a real implementation, you'd have a dedicated /callbacks endpoint
      const query: Record<string, string | number> = {
        page: pagination.page,
        limit: pagination.limit,
        status: 'callback',
      };

      if (filterCampaign !== 'all') {
        // Need to filter by campaign through list
        // This is a limitation - would need backend support
      }

      const data = await apiFetch<PaginatedResponse<LeadDto>>('/leads', {
        query,
        paginated: true,
      });

      // Filter and sort callbacks based on scheduled time
      const now = new Date();
      let filteredCallbacks = data.data.filter((lead) => lead.callbackScheduledAt);

      if (filterStatus === 'pending') {
        filteredCallbacks = filteredCallbacks.filter(
          (lead) => new Date(lead.callbackScheduledAt!) > now
        );
      } else if (filterStatus === 'overdue') {
        filteredCallbacks = filteredCallbacks.filter(
          (lead) => new Date(lead.callbackScheduledAt!) <= now
        );
      }

      // Sort by scheduled time
      filteredCallbacks.sort((a, b) => {
        const dateA = new Date(a.callbackScheduledAt!);
        const dateB = new Date(b.callbackScheduledAt!);
        return dateA.getTime() - dateB.getTime();
      });

      setCallbacks(filteredCallbacks);
      setPagination({
        page: data.page,
        limit: data.limit,
        total: filteredCallbacks.length,
        hasNextPage: data.hasNextPage,
        hasPreviousPage: data.hasPreviousPage,
      });

      // Calculate stats
      const allCallbacks = data.data.filter((lead) => lead.callbackScheduledAt);
      const pending = allCallbacks.filter((lead) => new Date(lead.callbackScheduledAt!) > now).length;
      const overdue = allCallbacks.filter((lead) => new Date(lead.callbackScheduledAt!) <= now).length;
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const completedToday = 0; // Would need to track this separately

      setStats({ pending, overdue, completedToday });
      setError(null);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to load callbacks');
      }
    } finally {
      setLoading(false);
    }
  }, [pagination.limit, pagination.page, filterCampaign, filterStatus]);

  useEffect(() => {
    loadCampaigns();
    loadAgents();
  }, [loadCampaigns, loadAgents]);

  useEffect(() => {
    loadCallbacks();
  }, [loadCallbacks]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getCallbackStatus = (scheduledAt: string) => {
    const now = new Date();
    const scheduled = new Date(scheduledAt);
    const diffMinutes = Math.round((scheduled.getTime() - now.getTime()) / (1000 * 60));

    if (diffMinutes < -60) {
      return { status: 'overdue', label: 'Overdue', color: 'bg-red-500' };
    } else if (diffMinutes < 0) {
      return { status: 'due', label: 'Due Now', color: 'bg-orange-500' };
    } else if (diffMinutes < 30) {
      return { status: 'soon', label: 'Coming Up', color: 'bg-yellow-500' };
    } else {
      return { status: 'scheduled', label: 'Scheduled', color: 'bg-blue-500' };
    }
  };

  const getAgentName = (agentId?: string | null) => {
    if (!agentId) return 'Any Agent';
    const agent = agents.find((a) => a.id === agentId);
    return agent?.name || 'Unknown Agent';
  };

  const callbackTypeLabels: Record<string, string> = {
    agent_specific: 'Agent Specific',
    campaign: 'Campaign',
    personal: 'Personal',
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Callbacks</h1>
          <p className="text-sm text-muted-foreground">
            Manage scheduled callback requests from leads
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Clock className="h-4 w-4 text-blue-500" />
              Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">Scheduled for later</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <AlertCircle className="h-4 w-4 text-red-500" />
              Overdue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
            <p className="text-xs text-muted-foreground">Need attention</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Completed Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completedToday}</div>
            <p className="text-xs text-muted-foreground">Successfully called back</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5" />
            Callback Queue
          </CardTitle>
          <CardDescription>
            Leads that have requested a callback or been scheduled for one
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="mb-4 flex flex-wrap gap-4">
            <Tabs value={filterStatus} onValueChange={setFilterStatus} className="w-full md:w-auto">
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="overdue">
                  Overdue
                  {stats.overdue > 0 && (
                    <Badge variant="destructive" className="ml-2">
                      {stats.overdue}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
              </TabsList>
            </Tabs>
            <Select
              value={filterCampaign}
              onValueChange={(v) => {
                setFilterCampaign(v);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by campaign" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Campaigns</SelectItem>
                {campaigns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, idx) => (
                <Skeleton key={idx} className="h-14 w-full" />
              ))}
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : callbacks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CalendarClock className="mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-lg font-medium">No Callbacks</p>
              <p className="text-sm text-muted-foreground">
                {filterStatus === 'overdue'
                  ? 'No overdue callbacks - great job!'
                  : 'No callbacks scheduled at this time'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contact</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Scheduled For</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Campaign</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {callbacks.map((callback) => {
                    const callbackStatus = callback.callbackScheduledAt
                      ? getCallbackStatus(callback.callbackScheduledAt)
                      : { status: 'unknown', label: 'Unknown', color: 'bg-gray-500' };

                    return (
                      <TableRow key={callback.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">
                              {callback.firstName || callback.lastName
                                ? `${callback.firstName || ''} ${callback.lastName || ''}`.trim()
                                : 'Unknown'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="rounded bg-muted px-2 py-1 text-sm font-mono">
                            {callback.phoneNumber}
                          </code>
                        </TableCell>
                        <TableCell>
                          {callback.callbackScheduledAt
                            ? formatDate(callback.callbackScheduledAt)
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`${callbackStatus.color} text-white`}
                          >
                            {callbackStatus.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {callback.callbackType
                            ? callbackTypeLabels[callback.callbackType] || callback.callbackType
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3 text-muted-foreground" />
                            {getAgentName(callback.callbackAgentId)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Target className="h-3 w-3 text-muted-foreground" />
                            {callback.list?.campaign?.name || '-'}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                // Would initiate call
                              }}
                            >
                              <Phone className="mr-1 h-4 w-4" />
                              Call
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                // Would dismiss callback
                              }}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <TablePagination
                page={pagination.page}
                limit={pagination.limit}
                total={pagination.total}
                hasNextPage={pagination.hasNextPage}
                hasPreviousPage={pagination.hasPreviousPage}
                labels={{
                  range: 'Showing {start}-{end} of {total} callbacks',
                  zero: '0 callbacks',
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
    </motion.div>
  );
}
