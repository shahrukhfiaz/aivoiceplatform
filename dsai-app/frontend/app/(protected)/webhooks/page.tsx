'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Webhook,
  Plus,
  Trash2,
  Check,
  X,
  Play,
  Pause,
  Send,
  History,
  Edit2,
  ExternalLink,
} from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

type WebhookEventType =
  | 'call.started'
  | 'call.ended'
  | 'lead.created'
  | 'lead.dispositioned'
  | 'campaign.started'
  | 'campaign.paused'
  | 'campaign.completed';

interface OutgoingWebhook {
  id: string;
  name: string;
  url: string;
  events: WebhookEventType[];
  isActive: boolean;
  secret?: string;
  headers?: Record<string, string>;
  maxRetries: number;
  timeoutMs: number;
  totalDelivered: number;
  totalFailed: number;
  lastDeliveredAt?: string;
  lastFailedAt?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

interface WebhookDeliveryLog {
  id: string;
  webhookId: string;
  event: WebhookEventType;
  status: 'pending' | 'delivered' | 'failed';
  payload: Record<string, unknown>;
  statusCode?: number;
  responseBody?: string;
  errorMessage?: string;
  attemptNumber: number;
  durationMs?: number;
  createdAt: string;
}

const WEBHOOK_EVENTS: { value: WebhookEventType; label: string; description: string }[] = [
  { value: 'call.started', label: 'Call Started', description: 'When a call is initiated' },
  { value: 'call.ended', label: 'Call Ended', description: 'When a call ends' },
  { value: 'lead.created', label: 'Lead Created', description: 'When a new lead is added' },
  { value: 'lead.dispositioned', label: 'Lead Dispositioned', description: 'When a lead receives a disposition' },
  { value: 'campaign.started', label: 'Campaign Started', description: 'When a campaign starts dialing' },
  { value: 'campaign.paused', label: 'Campaign Paused', description: 'When a campaign is paused' },
  { value: 'campaign.completed', label: 'Campaign Completed', description: 'When a campaign finishes' },
];

const createWebhookSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  url: z.string().url('Must be a valid URL'),
  events: z.array(z.string()).min(1, 'Select at least one event'),
  secret: z.string().optional(),
  maxRetries: z.number().int().min(1).max(10).default(3),
  timeoutMs: z.number().int().min(1000).max(30000).default(5000),
  headers: z.string().optional(),
});

export default function WebhooksPage() {
  const { dictionary: t } = useI18n();
  const [webhooks, setWebhooks] = useState<OutgoingWebhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<OutgoingWebhook | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editTarget, setEditTarget] = useState<OutgoingWebhook | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [logsTarget, setLogsTarget] = useState<OutgoingWebhook | null>(null);
  const [logs, setLogs] = useState<WebhookDeliveryLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const form = useForm<z.infer<typeof createWebhookSchema>>({
    resolver: zodResolver(createWebhookSchema),
    defaultValues: {
      name: '',
      url: '',
      events: [],
      secret: '',
      maxRetries: 3,
      timeoutMs: 5000,
      headers: '',
    },
  });

  const loadWebhooks = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiFetch<OutgoingWebhook[]>('/webhooks/outgoing');
      setWebhooks(response);
      setError(null);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to load webhooks');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWebhooks();
  }, [loadWebhooks]);

  useEffect(() => {
    if (editTarget) {
      form.reset({
        name: editTarget.name,
        url: editTarget.url,
        events: editTarget.events,
        secret: editTarget.secret || '',
        maxRetries: editTarget.maxRetries,
        timeoutMs: editTarget.timeoutMs,
        headers: editTarget.headers ? JSON.stringify(editTarget.headers, null, 2) : '',
      });
      setDialogOpen(true);
    }
  }, [editTarget, form]);

  const onSubmit = async (values: z.infer<typeof createWebhookSchema>) => {
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        name: values.name,
        url: values.url,
        events: values.events,
        maxRetries: values.maxRetries,
        timeoutMs: values.timeoutMs,
      };
      if (values.secret) {
        payload.secret = values.secret;
      }
      if (values.headers) {
        try {
          payload.headers = JSON.parse(values.headers);
        } catch {
          form.setError('headers', { message: 'Invalid JSON format' });
          setSubmitting(false);
          return;
        }
      }

      if (editTarget) {
        await apiFetch(`/webhooks/outgoing/${editTarget.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/webhooks/outgoing', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setDialogOpen(false);
      setEditTarget(null);
      form.reset();
      await loadWebhooks();
    } catch (err) {
      if (err instanceof ApiError) {
        form.setError('name', { message: err.message });
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to save webhook');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/webhooks/outgoing/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      setDeleteTarget(null);
      setDeleteDialogOpen(false);
      await loadWebhooks();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to delete webhook');
      }
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleActive = async (webhook: OutgoingWebhook) => {
    try {
      await apiFetch(`/webhooks/outgoing/${webhook.id}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !webhook.isActive }),
      });
      await loadWebhooks();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      }
    }
  };

  const handleTest = async (webhook: OutgoingWebhook) => {
    setTesting(webhook.id);
    setTestResult(null);
    try {
      const result = await apiFetch<{ success: boolean; message: string }>(
        `/webhooks/outgoing/${webhook.id}/test`,
        { method: 'POST' }
      );
      setTestResult(result);
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Test failed',
      });
    } finally {
      setTesting(null);
    }
  };

  const loadLogs = async (webhook: OutgoingWebhook) => {
    setLogsTarget(webhook);
    setLogsLoading(true);
    try {
      const response = await apiFetch<WebhookDeliveryLog[]>(
        `/webhooks/outgoing/${webhook.id}/logs?limit=50`
      );
      setLogs(response);
    } catch (err) {
      setLogs([]);
    } finally {
      setLogsLoading(false);
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditTarget(null);
      form.reset();
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Outgoing Webhooks</h1>
          <p className="text-sm text-muted-foreground">
            Send real-time event notifications to external services
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Create Webhook
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editTarget ? 'Edit Webhook' : 'Create Webhook'}</DialogTitle>
              <DialogDescription>
                {editTarget
                  ? 'Update webhook configuration'
                  : 'Configure a new outgoing webhook endpoint'}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="My Webhook" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Endpoint URL *</FormLabel>
                      <FormControl>
                        <Input placeholder="https://example.com/webhook" {...field} />
                      </FormControl>
                      <FormDescription>
                        The URL that will receive POST requests when events occur
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="events"
                  render={() => (
                    <FormItem>
                      <FormLabel>Events *</FormLabel>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                        {WEBHOOK_EVENTS.map((event) => (
                          <FormField
                            key={event.value}
                            control={form.control}
                            name="events"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(event.value)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...field.value, event.value])
                                        : field.onChange(
                                            field.value?.filter((v) => v !== event.value)
                                          );
                                    }}
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm font-medium">{event.label}</FormLabel>
                                  <p className="text-xs text-muted-foreground">{event.description}</p>
                                </div>
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="secret"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Signing Secret</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Optional secret for HMAC signature" {...field} />
                      </FormControl>
                      <FormDescription>
                        If provided, requests will include an X-Webhook-Signature header for verification
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="maxRetries"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Retries</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={10}
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="timeoutMs"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Timeout (ms)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1000}
                            max={30000}
                            step={1000}
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
                  control={form.control}
                  name="headers"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Custom Headers (JSON)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={'{\n  "Authorization": "Bearer token"\n}'}
                          className="font-mono text-sm"
                          rows={4}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>Optional additional headers as JSON object</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? 'Saving...' : editTarget ? 'Update' : 'Create'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {testResult && (
        <div
          className={`p-4 rounded-md ${
            testResult.success
              ? 'bg-green-500/10 border border-green-500/30'
              : 'bg-red-500/10 border border-red-500/30'
          }`}
        >
          <div className="flex items-center gap-2">
            {testResult.success ? (
              <Check className="h-5 w-5 text-green-500" />
            ) : (
              <X className="h-5 w-5 text-red-500" />
            )}
            <span className={testResult.success ? 'text-green-600' : 'text-red-600'}>
              {testResult.message}
            </span>
          </div>
        </div>
      )}

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Configured Webhooks
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <CardSkeleton />
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : webhooks.length === 0 ? (
            <div className="text-center py-8">
              <Webhook className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">No webhooks configured</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Create a webhook to send real-time events to external services
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Events</TableHead>
                    <TableHead>Delivered</TableHead>
                    <TableHead>Failed</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {webhooks.map((webhook) => (
                    <TableRow key={webhook.id}>
                      <TableCell className="font-medium">{webhook.name}</TableCell>
                      <TableCell>
                        <code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded max-w-[200px] truncate block">
                          {webhook.url}
                        </code>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {webhook.events.slice(0, 2).map((event) => (
                            <Badge key={event} variant="secondary" className="text-xs">
                              {event.split('.')[1]}
                            </Badge>
                          ))}
                          {webhook.events.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{webhook.events.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-green-600 font-medium">
                        {webhook.totalDelivered}
                      </TableCell>
                      <TableCell className="text-red-600 font-medium">
                        {webhook.totalFailed}
                      </TableCell>
                      <TableCell>
                        <Badge variant={webhook.isActive ? 'default' : 'secondary'}>
                          {webhook.isActive ? 'Active' : 'Paused'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleActive(webhook)}
                            title={webhook.isActive ? 'Pause' : 'Activate'}
                          >
                            {webhook.isActive ? (
                              <Pause className="h-4 w-4" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleTest(webhook)}
                            disabled={testing === webhook.id}
                            title="Test webhook"
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => loadLogs(webhook)}
                            title="View logs"
                          >
                            <History className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditTarget(webhook)}
                            title="Edit"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setError(null);
                              setDeleteTarget(webhook);
                              setDeleteDialogOpen(true);
                            }}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Webhook</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Logs Sheet */}
      <Sheet
        open={!!logsTarget}
        onOpenChange={(open) => {
          if (!open) {
            setLogsTarget(null);
            setLogs([]);
          }
        }}
      >
        <SheetContent className="sm:max-w-[600px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Delivery Logs: {logsTarget?.name}</SheetTitle>
            <SheetDescription>Recent webhook delivery attempts</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            {logsLoading ? (
              <CardSkeleton />
            ) : logs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No delivery logs yet
              </p>
            ) : (
              <div className="space-y-3">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className={`p-3 rounded-lg border ${
                      log.status === 'delivered'
                        ? 'border-green-500/30 bg-green-500/5'
                        : log.status === 'failed'
                        ? 'border-red-500/30 bg-red-500/5'
                        : 'border-yellow-500/30 bg-yellow-500/5'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            log.status === 'delivered'
                              ? 'default'
                              : log.status === 'failed'
                              ? 'destructive'
                              : 'secondary'
                          }
                        >
                          {log.status}
                        </Badge>
                        <Badge variant="outline">{log.event}</Badge>
                        {log.statusCode && (
                          <span className="text-xs text-muted-foreground">
                            HTTP {log.statusCode}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(log.createdAt)}
                      </span>
                    </div>
                    {log.durationMs && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Duration: {log.durationMs}ms | Attempt #{log.attemptNumber}
                      </p>
                    )}
                    {log.errorMessage && (
                      <p className="text-xs text-red-500 mt-2">{log.errorMessage}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
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
