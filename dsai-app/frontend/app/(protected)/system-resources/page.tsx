'use client';

import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { RefreshCcw, Play, Square, FileText, Shield, RotateCcw, Cpu, HardDrive, Network, MemoryStick } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface DockerContainerDto {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  createdAt: string;
  labels: Record<string, string>;
}

interface CpuCoreMetrics {
  coreId: number;
  usage: number;
}

interface SystemMetrics {
  timestamp: string;
  cpu: {
    overall: number;
    cores: CpuCoreMetrics[];
    count: number;
  };
  memory: {
    total: number;
    used: number;
    available: number;
    usagePercent: number;
    swap: {
      total: number;
      used: number;
      free: number;
      usagePercent: number;
    };
  };
  network: {
    interfaces: {
      name: string;
      rxBytes: number;
      txBytes: number;
      rxRate: number;
      txRate: number;
    }[];
  };
  disk: {
    ioStats: {
      readRate: number;
      writeRate: number;
      readMBps: number;
      writeMBps: number;
    };
    filesystems: {
      mount: string;
      type: string;
      total: number;
      used: number;
      available: number;
      usePercent: number;
    }[];
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatBytesPerSecond(bytes: number): string {
  if (bytes === 0) return '0 B/s';
  const k = 1024;
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function getProgressColor(value: number): string {
  if (value < 50) return 'bg-emerald-500';
  if (value < 75) return 'bg-amber-500';
  return 'bg-rose-500';
}

export default function DockersPage() {
  const { dictionary } = useI18n();
  const { user } = useAuth();
  const [containers, setContainers] = useState<DockerContainerDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMap, setActionMap] = useState<Record<string, boolean>>({});
  const [logsDialogOpen, setLogsDialogOpen] = useState(false);
  const [logsTarget, setLogsTarget] = useState<DockerContainerDto | null>(null);
  const [logsContent, setLogsContent] = useState('');
  const [logsLoading, setLogsLoading] = useState(false);

  // System monitoring state
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const isReadOnly = user?.role === 'viewer';

  const loadContainers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<DockerContainerDto[]>('/docker/containers');
      setContainers(data);
      setError(null);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(dictionary.systemResources.errors.load);
      }
    } finally {
      setLoading(false);
    }
  }, [dictionary.systemResources.errors.load]);

  const loadMetrics = useCallback(async () => {
    try {
      const data = await apiFetch<SystemMetrics>('/monitoring/system');
      setMetrics(data);
      setMetricsError(null);
    } catch (err) {
      if (err instanceof Error) {
        setMetricsError(err.message);
      } else {
        setMetricsError(dictionary.systemResources.errors.loadMetrics);
      }
    } finally {
      setMetricsLoading(false);
    }
  }, [dictionary.systemResources.errors.loadMetrics]);

  useEffect(() => {
    loadContainers();
    loadMetrics();

    // Poll metrics every 2 seconds
    intervalRef.current = setInterval(loadMetrics, 2000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [loadContainers, loadMetrics]);

  const handleStart = async (container: DockerContainerDto) => {
    if (isReadOnly) {
      return;
    }
    setActionMap((prev) => ({ ...prev, [container.id]: true }));
    try {
      await apiFetch(`/docker/containers/${container.id}/start`, { method: 'POST' });
      await loadContainers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : dictionary.systemResources.errors.start);
    } finally {
      setActionMap((prev) => ({ ...prev, [container.id]: false }));
    }
  };

  const handleStop = async (container: DockerContainerDto) => {
    if (isReadOnly) {
      return;
    }
    setActionMap((prev) => ({ ...prev, [container.id]: true }));
    try {
      await apiFetch(`/docker/containers/${container.id}/stop`, { method: 'POST' });
      await loadContainers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : dictionary.systemResources.errors.stop);
    } finally {
      setActionMap((prev) => ({ ...prev, [container.id]: false }));
    }
  };

  const handlePullAndRestart = async (container: DockerContainerDto) => {
    if (isReadOnly) {
      return;
    }
    setActionMap((prev) => ({ ...prev, [container.id]: true }));
    try {
      await apiFetch(`/docker/containers/${container.id}/pull`, { method: 'POST' });
      await loadContainers();
    } catch (err) {
      console.error(err);
      setError(err instanceof ApiError ? err.message : dictionary.systemResources.errors.pull);
    } finally {
      setActionMap((prev) => ({ ...prev, [container.id]: false }));
    }
  };

  const openLogsDialog = async (container: DockerContainerDto) => {
    setLogsTarget(container);
    setLogsDialogOpen(true);
    setLogsLoading(true);
    try {
      const data = await apiFetch<{ logs: string }>(
        `/docker/containers/${container.id}/logs?tail=300`,
      );
      setLogsContent(data.logs);
    } catch (err) {
      setLogsContent('');
      setError(err instanceof ApiError ? err.message : dictionary.systemResources.errors.logs);
    } finally {
      setLogsLoading(false);
    }
  };

  const closeLogsDialog = (open: boolean) => {
    setLogsDialogOpen(open);
    if (!open) {
      setLogsTarget(null);
      setLogsContent('');
    }
  };

  const statusVariant = useMemo(
    () => ({
      running: 'bg-emerald-500/10 text-emerald-600',
      exited: 'bg-rose-500/10 text-rose-600',
      paused: 'bg-amber-500/10 text-amber-700',
      created: 'bg-blue-500/10 text-blue-600',
    }),
    [],
  );

  const formatCreated = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  };

  // Get primary network interface for display
  const primaryNetwork = metrics?.network?.interfaces?.find(
    (iface) => iface.name !== 'lo' && (iface.rxRate > 0 || iface.txRate > 0 || iface.rxBytes > 0)
  ) || metrics?.network?.interfaces?.[0];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{dictionary.systemResources.title}</h1>
          <p className="text-sm text-muted-foreground">{dictionary.systemResources.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {isReadOnly ? (
            <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted px-3 py-2 text-xs text-muted-foreground">
              <Shield className="h-4 w-4" />
              {dictionary.systemResources.notices.readOnly}
            </div>
          ) : null}
          <Button variant="outline" onClick={loadContainers} disabled={loading}>
            <RefreshCcw className="mr-2 h-4 w-4" /> {dictionary.systemResources.refresh}
          </Button>
        </div>
      </div>

      {/* System Monitoring Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* CPU Card */}
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{dictionary.systemResources.monitoring.cpu}</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-2 w-full" />
              </div>
            ) : metricsError ? (
              <p className="text-xs text-destructive">{metricsError}</p>
            ) : metrics?.cpu ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">{metrics.cpu.overall.toFixed(1)}%</span>
                  <span className="text-xs text-muted-foreground">{dictionary.systemResources.monitoring.overall}</span>
                </div>
                <div className="space-y-1">
                  {metrics.cpu.cores.map((core) => (
                    <div key={core.coreId} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-14">{dictionary.systemResources.monitoring.core} {core.coreId}</span>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${getProgressColor(core.usage)}`}
                          style={{ width: `${Math.min(core.usage, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono w-12 text-right">{core.usage.toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Memory Card */}
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{dictionary.systemResources.monitoring.memory}</CardTitle>
            <MemoryStick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-2 w-full" />
              </div>
            ) : metricsError ? (
              <p className="text-xs text-destructive">{metricsError}</p>
            ) : metrics?.memory ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">{metrics.memory.usagePercent.toFixed(1)}%</span>
                  <span className="text-xs text-muted-foreground">{formatBytes(metrics.memory.used)} / {formatBytes(metrics.memory.total)}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${getProgressColor(metrics.memory.usagePercent)}`}
                    style={{ width: `${Math.min(metrics.memory.usagePercent, 100)}%` }}
                  />
                </div>
                {/* Swap */}
                {metrics.memory.swap.total > 0 && (
                  <div className="pt-2 border-t border-border/40">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">{dictionary.systemResources.monitoring.swap}</span>
                      <span className="text-xs font-mono">{metrics.memory.swap.usagePercent.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${getProgressColor(metrics.memory.swap.usagePercent)}`}
                        style={{ width: `${Math.min(metrics.memory.swap.usagePercent, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>{formatBytes(metrics.memory.swap.used)}</span>
                      <span>{formatBytes(metrics.memory.swap.total)}</span>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Network Card */}
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{dictionary.systemResources.monitoring.network}</CardTitle>
            <Network className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-20" />
              </div>
            ) : metricsError ? (
              <p className="text-xs text-destructive">{metricsError}</p>
            ) : primaryNetwork ? (
              <div className="space-y-3">
                <div className="text-xs text-muted-foreground mb-2">{primaryNetwork.name}</div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-muted-foreground block">{dictionary.systemResources.monitoring.receiving}</span>
                    <span className="text-lg font-bold text-emerald-600">{formatBytesPerSecond(primaryNetwork.rxRate)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-muted-foreground block">{dictionary.systemResources.monitoring.sending}</span>
                    <span className="text-lg font-bold text-blue-600">{formatBytesPerSecond(primaryNetwork.txRate)}</span>
                  </div>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t border-border/40">
                  <span>{dictionary.systemResources.monitoring.total}: {formatBytes(primaryNetwork.rxBytes)}</span>
                  <span>{formatBytes(primaryNetwork.txBytes)}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No network data</p>
            )}
          </CardContent>
        </Card>

        {/* Disk Card */}
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{dictionary.systemResources.monitoring.disk}</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-20" />
              </div>
            ) : metricsError ? (
              <p className="text-xs text-destructive">{metricsError}</p>
            ) : metrics?.disk ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-muted-foreground block">{dictionary.systemResources.monitoring.reading}</span>
                    <span className="text-lg font-bold text-emerald-600">{metrics.disk.ioStats.readMBps.toFixed(2)} MB/s</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-muted-foreground block">{dictionary.systemResources.monitoring.writing}</span>
                    <span className="text-lg font-bold text-amber-600">{metrics.disk.ioStats.writeMBps.toFixed(2)} MB/s</span>
                  </div>
                </div>
                {/* Root filesystem */}
                {metrics.disk.filesystems.length > 0 && (
                  <div className="pt-2 border-t border-border/40">
                    {metrics.disk.filesystems.slice(0, 2).map((fs) => (
                      <div key={fs.mount} className="mb-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground truncate max-w-[100px]">{fs.mount}</span>
                          <span className="text-xs font-mono">{fs.usePercent.toFixed(0)}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${getProgressColor(fs.usePercent)}`}
                            style={{ width: `${Math.min(fs.usePercent, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Containers Table */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle>Containers</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <CardSkeleton />
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : containers.length === 0 ? (
            <p className="text-sm text-muted-foreground">{dictionary.systemResources.empty}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{dictionary.systemResources.table.name}</TableHead>
                    <TableHead>{dictionary.systemResources.table.image}</TableHead>
                    <TableHead>{dictionary.systemResources.table.state}</TableHead>
                    <TableHead>{dictionary.systemResources.table.status}</TableHead>
                    <TableHead>{dictionary.systemResources.table.created}</TableHead>
                    <TableHead className="text-right">{dictionary.systemResources.table.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {containers.map((container) => {
                    const badgeClass = statusVariant[container.state as keyof typeof statusVariant] ??
                      'bg-muted text-foreground';
                    return (
                      <TableRow key={container.id}>
                        <TableCell className="font-medium">{container.name}</TableCell>
                        <TableCell>
                          <span className="font-mono text-xs text-muted-foreground">{container.image}</span>
                        </TableCell>
                        <TableCell>
                          <Badge className={badgeClass}>
                            {dictionary.systemResources.status[container.state as keyof typeof dictionary.systemResources.status] ??
                              container.state}
                          </Badge>
                        </TableCell>
                        <TableCell>{container.status}</TableCell>
                        <TableCell>{formatCreated(container.createdAt)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => openLogsDialog(container)}
                              aria-label={dictionary.systemResources.buttons.logs}
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                            {isReadOnly ? null : (
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handlePullAndRestart(container)}
                                disabled={actionMap[container.id]}
                                aria-label={dictionary.systemResources.buttons.pull}
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleStart(container)}
                              disabled={isReadOnly || actionMap[container.id] || container.state === 'running'}
                              aria-label={dictionary.systemResources.buttons.start}
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="icon"
                              onClick={() => handleStop(container)}
                              disabled={isReadOnly || actionMap[container.id] || container.state !== 'running'}
                              aria-label={dictionary.systemResources.buttons.stop}
                            >
                              <Square className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={logsDialogOpen} onOpenChange={closeLogsDialog}>
        <DialogContent className="w-[1400px] max-w-[95vw]">
          <DialogHeader>
            <DialogTitle>{dictionary.systemResources.logsTitle}</DialogTitle>
            <DialogDescription>{logsTarget?.name}</DialogDescription>
          </DialogHeader>
          {logsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          ) : (
            <pre className="max-h-[65vh] overflow-auto rounded-md bg-muted p-4 text-xs font-mono whitespace-pre">
              {logsContent || dictionary.systemResources.errors.logs}
            </pre>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

function CardSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, idx) => (
        <Skeleton key={idx} className="h-10 w-full" />
      ))}
    </div>
  );
}
