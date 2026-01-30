'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  RefreshCcw,
  Users,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Clock,
  CheckCircle,
  Activity,
  AreaChart as AreaChartIcon
} from 'lucide-react';
import { apiFetch, type PaginatedResponse } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useI18n } from '@/lib/i18n';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface AgentDto {
  id: string;
  name: string;
  status: string;
}

interface CallSummaryDto {
  id: string;
  uuid: string;
  agentId?: string | null;
  callType?: 'inbound' | 'outbound';
  startedAt: string | null;
  endedAt: string | null;
}

interface EnhancedSummaryResponse {
  totalCalls: number;
  activeCalls: number;
  inboundCalls: number;
  outboundCalls: number;
  totalDurationSeconds: number;
  averageDurationSeconds: number;
  successRate: number;
  callsByAgent: { agentId: string; agentName: string; count: number }[];
}

const timeRangeOptions = ['1', '3', '6', '12'] as const;

type TimeRange = (typeof timeRangeOptions)[number];

const granularityOptions = ['day', 'week', 'month', 'year'] as const;

type Granularity = (typeof granularityOptions)[number];

// Colors for donut chart - distinct black and gray
const DONUT_COLORS = {
  inbound: '#1f2937',  // dark gray (near black)
  outbound: '#9ca3af', // medium gray
};

export default function DashboardPage() {
  const { dictionary } = useI18n();
  const [runningAgents, setRunningAgents] = useState(0);
  const [agents, setAgents] = useState<AgentDto[]>([]);
  const [calls, setCalls] = useState<CallSummaryDto[]>([]);
  const [previousSummary, setPreviousSummary] = useState<EnhancedSummaryResponse | null>(null);
  const [enhancedSummary, setEnhancedSummary] = useState<EnhancedSummaryResponse>({
    totalCalls: 0,
    activeCalls: 0,
    inboundCalls: 0,
    outboundCalls: 0,
    totalDurationSeconds: 0,
    averageDurationSeconds: 0,
    successRate: 0,
    callsByAgent: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<TimeRange>('1');
  const [granularity, setGranularity] = useState<Granularity>('month');
  const [agentFilter, setAgentFilter] = useState<string>('all');

  const loadAgents = useCallback(async () => {
    try {
      const response = await apiFetch<PaginatedResponse<AgentDto>>('/agents', {
        query: { page: 1, limit: 100 },
        paginated: true,
      });
      setAgents(response.data);
      setRunningAgents(
        response.data.filter((agent) => agent.status === 'running').length,
      );
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    void loadAgents();
  }, [loadAgents]);

  // Calculate previous period range based on current range
  const getPreviousRange = useCallback((currentRange: TimeRange): string => {
    const months = parseInt(currentRange, 10);
    return String(months * 2); // Get double the range to compare previous period
  }, []);

  const fetchCallData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append('range', range);
      if (agentFilter !== 'all') {
        params.append('agentId', agentFilter);
      }

      // Fetch previous period for trend calculation
      const prevParams = new URLSearchParams();
      prevParams.append('range', getPreviousRange(range));
      if (agentFilter !== 'all') {
        prevParams.append('agentId', agentFilter);
      }

      const query = params.toString();
      const prevQuery = prevParams.toString();

      const [enhancedData, prevData, callsResponse] = await Promise.all([
        apiFetch<EnhancedSummaryResponse>(`/webhooks/enhanced-summary?${query}`),
        apiFetch<EnhancedSummaryResponse>(`/webhooks/enhanced-summary?${prevQuery}`).catch(() => null),
        apiFetch<PaginatedResponse<CallSummaryDto>>(`/webhooks/calls?${query}&page=1&limit=100`, {
          paginated: true,
        }),
      ]);

      setEnhancedSummary(enhancedData);
      if (prevData) {
        // Calculate the difference (previous period = total - current)
        setPreviousSummary({
          ...prevData,
          totalCalls: Math.max(0, prevData.totalCalls - enhancedData.totalCalls),
          inboundCalls: Math.max(0, prevData.inboundCalls - enhancedData.inboundCalls),
          outboundCalls: Math.max(0, prevData.outboundCalls - enhancedData.outboundCalls),
        });
      }
      setCalls(callsResponse.data ?? []);
    } catch (err) {
      console.error(err);
      setError(dictionary.dashboard.errors.load);
    } finally {
      setLoading(false);
    }
  }, [agentFilter, dictionary.dashboard.errors.load, range, getPreviousRange]);

  useEffect(() => {
    void fetchCallData();
  }, [fetchCallData]);

  // Calculate trend percentage
  const calculateTrend = (current: number, previous: number | undefined): { value: number; isPositive: boolean } | null => {
    if (previous === undefined || previous === 0) {
      return current > 0 ? { value: 100, isPositive: true } : null;
    }
    const change = ((current - previous) / previous) * 100;
    return { value: Math.abs(change), isPositive: change >= 0 };
  };

  const stats = useMemo(
    () => [
      {
        title: dictionary.dashboard.stats.totalCalls,
        value: enhancedSummary.totalCalls,
        icon: Phone,
        trend: calculateTrend(enhancedSummary.totalCalls, previousSummary?.totalCalls),
      },
      {
        title: dictionary.dashboard.stats.activeCalls ?? 'Active Calls',
        value: enhancedSummary.activeCalls,
        icon: Activity,
        highlight: enhancedSummary.activeCalls > 0,
      },
      {
        title: dictionary.dashboard.stats.inboundCalls ?? 'Inbound Calls',
        value: enhancedSummary.inboundCalls,
        icon: PhoneIncoming,
        trend: calculateTrend(enhancedSummary.inboundCalls, previousSummary?.inboundCalls),
      },
      {
        title: dictionary.dashboard.stats.outboundCalls ?? 'Outbound Calls',
        value: enhancedSummary.outboundCalls,
        icon: PhoneOutgoing,
        trend: calculateTrend(enhancedSummary.outboundCalls, previousSummary?.outboundCalls),
      },
      {
        title: dictionary.dashboard.stats.avgDuration,
        value: formatDurationFromSeconds(enhancedSummary.averageDurationSeconds),
        icon: Clock,
      },
      {
        title: dictionary.dashboard.stats.successRate ?? 'Success Rate',
        value: `${enhancedSummary.successRate.toFixed(1)}%`,
        icon: CheckCircle,
      },
      {
        title: dictionary.dashboard.stats.runningAgents,
        value: runningAgents,
        icon: Users,
      },
    ],
    [dictionary.dashboard.stats, runningAgents, enhancedSummary, previousSummary],
  );

  const agentOptions = useMemo(() => {
    const set = new Map<string, string>();
    agents.forEach((agent) => set.set(agent.id, agent.name));
    calls.forEach((call) => {
      if (call.agentId && !set.has(call.agentId)) {
        set.set(call.agentId, call.agentId);
      }
    });
    return Array.from(set.entries()).map(([value, label]) => ({ value, label }));
  }, [agents, calls]);

  const chartData = useMemo(() => {
    const buckets = new Map<string, { total: number; inbound: number; outbound: number }>();
    calls.forEach((call) => {
      const dateStr = call.startedAt ?? call.endedAt;
      if (!dateStr) {
        return;
      }
      const date = new Date(dateStr);
      if (Number.isNaN(date.getTime())) {
        return;
      }

      let key: string;
      switch (granularity) {
        case 'day':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          break;
        case 'week': {
          const startOfYear = new Date(date.getFullYear(), 0, 1);
          const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
          const weekNum = Math.ceil((days + startOfYear.getDay() + 1) / 7);
          key = `${date.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
          break;
        }
        case 'year':
          key = `${date.getFullYear()}`;
          break;
        case 'month':
        default:
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
      }

      const existing = buckets.get(key) ?? { total: 0, inbound: 0, outbound: 0 };
      existing.total += 1;
      if (call.callType === 'inbound') {
        existing.inbound += 1;
      } else if (call.callType === 'outbound') {
        existing.outbound += 1;
      }
      buckets.set(key, existing);
    });

    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, data]) => ({ label, ...data }));
  }, [calls, granularity]);

  const maxChartValue = useMemo(() => {
    return chartData.reduce((max, item) => Math.max(max, item.total), 0);
  }, [chartData]);

  const recentCalls = useMemo(() => calls.slice(0, 5), [calls]);

  // Donut chart data
  const donutData = useMemo(() => {
    const total = enhancedSummary.inboundCalls + enhancedSummary.outboundCalls;
    if (total === 0) return null;

    const inboundPercent = (enhancedSummary.inboundCalls / total) * 100;
    const outboundPercent = (enhancedSummary.outboundCalls / total) * 100;

    return {
      total,
      items: [
        { label: dictionary.dashboard.stats.inboundCalls ?? 'Inbound', value: enhancedSummary.inboundCalls, percent: inboundPercent, color: DONUT_COLORS.inbound },
        { label: dictionary.dashboard.stats.outboundCalls ?? 'Outbound', value: enhancedSummary.outboundCalls, percent: outboundPercent, color: DONUT_COLORS.outbound },
      ],
    };
  }, [enhancedSummary, dictionary.dashboard.stats]);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{dictionary.dashboard.title}</h1>
          <p className="text-sm text-muted-foreground">{dictionary.dashboard.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-40">
            <Select value={range} onValueChange={(value) => setRange(value as TimeRange)}>
              <SelectTrigger>
                <SelectValue placeholder={dictionary.dashboard.filters.timeRange} />
              </SelectTrigger>
              <SelectContent>
                {timeRangeOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {dictionary.dashboard.filters.ranges[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-48">
            <Select value={agentFilter} onValueChange={setAgentFilter}>
              <SelectTrigger>
                <SelectValue placeholder={dictionary.dashboard.filters.agent} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{dictionary.dashboard.filters.allAgents}</SelectItem>
                {agentOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={fetchCallData} disabled={loading}>
            <RefreshCcw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} /> {dictionary.dashboard.filters.refresh}
          </Button>
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {/* Stat Cards with Trend Indicators */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card
              key={stat.title}
              className={cn(
                "border-border/60 overflow-hidden transition-all hover:shadow-md",
                stat.highlight && "border-primary ring-1 ring-primary/20"
              )}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="p-2 rounded-lg bg-muted">
                    <Icon className="h-4 w-4 text-foreground" />
                  </div>
                  {stat.trend && (
                    <div className="flex items-center gap-1 text-xs font-medium rounded-full px-2 py-0.5 text-foreground bg-muted">
                      {stat.trend.isPositive ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      <span>{stat.trend.value.toFixed(1)}%</span>
                    </div>
                  )}
                </div>
                <div className="mt-3">
                  {loading ? (
                    <Skeleton className="h-7 w-20 rounded" />
                  ) : (
                    <div className={cn(
                      "text-2xl font-bold tracking-tight",
                      stat.highlight && "text-primary"
                    )}>
                      {stat.value}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {stat.title}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Area Chart */}
        <Card className="border-border/60 lg:col-span-8">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-base font-semibold">
                {dictionary.dashboard.charts.callsPer?.[granularity] ??
                  dictionary.dashboard.charts.callsPerMonth}
              </CardTitle>
              <CardDescription>
                {dictionary.dashboard.filters.ranges[range]}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={granularity} onValueChange={(value) => setGranularity(value as Granularity)}>
                <SelectTrigger className="w-28 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {granularityOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {dictionary.dashboard.filters.granularity?.[option] ?? option.charAt(0).toUpperCase() + option.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <AreaChartIcon className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-48 w-full rounded" />
              </div>
            ) : chartData.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground">
                {dictionary.dashboard.charts.empty}
              </div>
            ) : (
              <div className="h-56">
                <AreaChart
                  data={chartData}
                  maxValue={maxChartValue}
                  granularity={granularity}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Donut Chart */}
        <Card className="border-border/60 lg:col-span-4">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              {dictionary.dashboard.charts?.callTypes ?? 'Call Types'}
            </CardTitle>
            <CardDescription>
              {dictionary.dashboard.charts?.distribution ?? 'Distribution by type'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <Skeleton className="h-32 w-32 rounded-full" />
              </div>
            ) : donutData ? (
              <div className="flex flex-col items-center gap-4">
                <DonutChart data={donutData} />
                <div className="flex gap-6">
                  {donutData.items.map((item) => (
                    <div key={item.label} className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <div className="text-sm">
                        <span className="text-muted-foreground">{item.label}</span>
                        <span className="font-medium ml-2">{item.percent.toFixed(0)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-48 text-muted-foreground">
                {dictionary.dashboard.charts.empty}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Calls & Calls by Agent */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Recent Calls */}
        <Card className="border-border/60 lg:col-span-7">
          <CardHeader>
            <CardTitle className="text-base font-semibold">{dictionary.calls.title}</CardTitle>
            <CardDescription>{dictionary.dashboard.charts?.recentActivity ?? 'Recent call activity'}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <DetailSkeleton />
            ) : recentCalls.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{dictionary.calls.empty}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{dictionary.calls.table.uuid}</TableHead>
                    <TableHead>{dictionary.calls.table.startedAt}</TableHead>
                    <TableHead>{dictionary.calls.table.duration}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentCalls.map((call) => (
                    <TableRow key={call.id}>
                      <TableCell className="max-w-[180px] truncate font-mono text-xs text-muted-foreground">
                        {call.uuid}
                      </TableCell>
                      <TableCell className="text-sm">{formatDateTime(call.startedAt)}</TableCell>
                      <TableCell className="text-sm">
                        {formatDurationFromRange(call.startedAt, call.endedAt, dictionary.calls.durationUnknown)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Calls by Agent */}
        <Card className="border-border/60 lg:col-span-5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base font-semibold">
                {dictionary.dashboard.stats.callsByAgent ?? 'Calls by Agent'}
              </CardTitle>
              <CardDescription>{dictionary.dashboard.charts?.topAgents ?? 'Top performing agents'}</CardDescription>
            </div>
            <Users className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <DetailSkeleton />
            ) : enhancedSummary.callsByAgent.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {dictionary.dashboard.charts?.noAgents ?? 'No agent data available'}
              </p>
            ) : (
              <div className="space-y-4">
                {enhancedSummary.callsByAgent.slice(0, 5).map((item, index) => {
                  const maxCount = enhancedSummary.callsByAgent[0]?.count || 1;
                  const percentage = (item.count / maxCount) * 100;
                  return (
                    <div key={item.agentId} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                            index === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                          )}>
                            {index + 1}
                          </div>
                          <span className="font-medium truncate max-w-[150px]">{item.agentName}</span>
                        </div>
                        <span className="text-muted-foreground">{item.count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ duration: 0.5, delay: index * 0.1 }}
                          className={cn(
                            "h-full rounded-full",
                            index === 0 ? "bg-primary" : "bg-primary/60"
                          )}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}

// Area Chart Component
interface AreaChartProps {
  data: { label: string; total: number; inbound: number; outbound: number }[];
  maxValue: number;
  granularity: Granularity;
}

function AreaChart({ data, maxValue, granularity }: AreaChartProps) {
  if (data.length === 0) return null;

  const width = 600;
  const height = 200;
  const padding = { top: 20, right: 30, bottom: 40, left: 50 };

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const effectiveMax = maxValue > 0 ? maxValue : 1;
  const yScale = chartHeight / effectiveMax;

  // Calculate x positions
  const getX = (index: number) => {
    if (data.length === 1) {
      return padding.left + chartWidth / 2;
    }
    return padding.left + (index / (data.length - 1)) * chartWidth;
  };

  const getY = (value: number) => {
    return padding.top + chartHeight - (value * yScale);
  };

  // Create SVG path for area (smooth curve)
  const createAreaPath = () => {
    if (data.length === 0) return '';

    if (data.length === 1) {
      // For single point, draw a small area around it
      const x = getX(0);
      const y = getY(data[0].total);
      const bottomY = padding.top + chartHeight;
      const barWidth = 40;
      return `M ${x - barWidth},${bottomY} L ${x - barWidth},${y} L ${x + barWidth},${y} L ${x + barWidth},${bottomY} Z`;
    }

    const points = data.map((d, i) => ({ x: getX(i), y: getY(d.total) }));
    const bottomY = padding.top + chartHeight;

    let path = `M ${points[0].x},${bottomY}`;
    path += ` L ${points[0].x},${points[0].y}`;

    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x},${points[i].y}`;
    }

    path += ` L ${points[points.length - 1].x},${bottomY}`;
    path += ' Z';

    return path;
  };

  // Create SVG path for line
  const createLinePath = () => {
    if (data.length === 0) return '';

    if (data.length === 1) {
      const x = getX(0);
      const y = getY(data[0].total);
      return `M ${x - 20},${y} L ${x + 20},${y}`;
    }

    return data.map((d, i) => {
      const x = getX(i);
      const y = getY(d.total);
      return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
    }).join(' ');
  };

  const showLabel = (index: number) => {
    if (data.length <= 6) return true;
    if (data.length <= 12) return index % 2 === 0;
    return index % Math.ceil(data.length / 6) === 0;
  };

  // Y-axis tick values
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(ratio => Math.round(effectiveMax * ratio));

  return (
    <div className="relative w-full h-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Gradient definition */}
        <defs>
          <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--foreground))" stopOpacity="0.15" />
            <stop offset="100%" stopColor="hsl(var(--foreground))" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Grid lines and Y-axis labels */}
        {yTicks.map((value, i) => {
          const y = getY(value);
          return (
            <g key={i}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="currentColor"
                strokeOpacity="0.1"
                strokeDasharray="4,4"
              />
              <text
                x={padding.left - 10}
                y={y + 4}
                className="fill-muted-foreground"
                textAnchor="end"
                fontSize="11"
              >
                {value}
              </text>
            </g>
          );
        })}

        {/* Area */}
        <motion.path
          d={createAreaPath()}
          fill="url(#areaGradient)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        />

        {/* Line */}
        <motion.path
          d={createLinePath()}
          fill="none"
          stroke="hsl(var(--foreground))"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1 }}
        />

        {/* Data points and X-axis labels */}
        {data.map((d, i) => {
          const x = getX(i);
          const y = getY(d.total);
          return (
            <g key={i}>
              <motion.circle
                cx={x}
                cy={y}
                r="4"
                className="fill-background stroke-foreground"
                strokeWidth="2"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.05 }}
              />
              {/* X-axis labels */}
              {showLabel(i) && (
                <text
                  x={x}
                  y={height - 10}
                  className="fill-muted-foreground"
                  textAnchor="middle"
                  fontSize="11"
                >
                  {formatChartLabel(d.label, granularity)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Hover tooltips */}
      <div className="absolute inset-0 flex" style={{ left: padding.left, right: padding.right, top: padding.top, bottom: padding.bottom }}>
        {data.map((d, i) => (
          <div
            key={i}
            className="flex-1 group relative"
          >
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              <div className="bg-popover border rounded-lg shadow-lg px-3 py-2 text-xs whitespace-nowrap">
                <div className="font-medium">{formatChartLabel(d.label, granularity)}</div>
                <div className="text-muted-foreground">Total: {d.total}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Donut Chart Component
interface DonutChartProps {
  data: {
    total: number;
    items: { label: string; value: number; percent: number; color: string }[];
  };
}

function DonutChart({ data }: DonutChartProps) {
  const size = 140;
  const strokeWidth = 20;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  let cumulativePercent = 0;

  return (
    <div className="relative">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.1"
          strokeWidth={strokeWidth}
        />

        {/* Data segments */}
        {data.items.map((item, i) => {
          const strokeDasharray = `${(item.percent / 100) * circumference} ${circumference}`;
          const rotation = cumulativePercent * 3.6 - 90; // -90 to start from top
          cumulativePercent += item.percent;

          return (
            <motion.circle
              key={i}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={item.color}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              strokeDashoffset="0"
              strokeLinecap="round"
              style={{
                transform: `rotate(${rotation}deg)`,
                transformOrigin: 'center',
              }}
              initial={{ strokeDasharray: `0 ${circumference}` }}
              animate={{ strokeDasharray }}
              transition={{ duration: 0.8, delay: i * 0.2 }}
            />
          );
        })}
      </svg>

      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-2xl font-bold">{data.total}</div>
        <div className="text-xs text-muted-foreground">Total</div>
      </div>
    </div>
  );
}

function formatDurationFromSeconds(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '—';
  }
  const totalSeconds = Math.floor(value);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

function formatDurationFromRange(
  start: string | null,
  end: string | null,
  fallback: string,
): string {
  if (!start || !end) {
    return fallback;
  }
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return fallback;
  }
  const seconds = Math.max(0, Math.floor((endDate.getTime() - startDate.getTime()) / 1000));
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${remaining.toString().padStart(2, '0')}s`;
}

function formatChartLabel(label: string, granularity: Granularity): string {
  switch (granularity) {
    case 'day': {
      const parts = label.split('-');
      if (parts.length === 3) {
        const month = parseInt(parts[1], 10);
        const day = parts[2];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[month - 1]} ${parseInt(day, 10)}`;
      }
      return label;
    }
    case 'week':
      return label.split('-')[1] || label;
    case 'month': {
      const parts = label.split('-');
      if (parts.length === 2) {
        const year = parts[0].slice(-2);
        const month = parseInt(parts[1], 10);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[month - 1]} '${year}`;
      }
      return label;
    }
    case 'year':
      return label;
    default:
      return label;
  }
}

function DetailSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, idx) => (
        <Skeleton key={idx} className="h-4 w-full" />
      ))}
    </div>
  );
}
