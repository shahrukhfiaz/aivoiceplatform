'use client';

import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react';
import { motion } from 'framer-motion';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PlusCircle, Pencil, Trash2, Shield, Eye, EyeOff, PhoneIncoming, PhoneOutgoing } from 'lucide-react';
import { apiFetch, ApiError, type PaginatedResponse } from '@/lib/api';
import { useI18n, type Dictionary } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TablePagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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

const DIRECTION_OPTIONS = ['inbound', 'outbound'] as const;
type DirectionValue = (typeof DIRECTION_OPTIONS)[number];

const TRANSPORT_OPTIONS = ['udp', 'tcp', 'tls', 'wss'] as const;
type TransportValue = (typeof TRANSPORT_OPTIONS)[number];
const DEFAULT_TRANSPORT: TransportValue = 'udp';
const CODECS_DEFAULT = 'ulaw,alaw';
const CODEC_TOKEN_REGEX = /^[a-zA-Z0-9_.-]+$/;

const parseCodecs = (value: string): string[] =>
  value
    .split(',')
    .map((codec) => codec.trim())
    .filter(Boolean);

const normalizeCodecsValue = (value?: string): string => {
  const codecs = parseCodecs(value ?? '');
  return codecs.length > 0 ? codecs.join(',') : CODECS_DEFAULT;
};

const makeTrunkSchema = (dict: Dictionary) =>
  z.object({
    name: z
      .string()
      .min(2, dict.trunks.validation.nameMin)
      .max(50, dict.trunks.validation.nameMax),
    direction: z.enum(DIRECTION_OPTIONS),
    host: z.string().optional(),
    port: z.number().int().min(1).max(65535).optional(),
    username: z.string().optional(),
    password: z.string().optional(),
    transport: z.enum(TRANSPORT_OPTIONS),
    codecs: z
      .string()
      .transform((val) => val.trim())
      .refine((val) => parseCodecs(val).length > 0, {
        message: dict.trunks.validation.codecsRequired,
      })
      .refine(
        (val) => parseCodecs(val).every((codec) => CODEC_TOKEN_REGEX.test(codec)),
        {
          message: dict.trunks.validation.codecsFormat,
        },
      )
      .transform((val) => normalizeCodecsValue(val)),
    didNumber: z.string().optional(),
    agentId: z.string().optional(),
    allowedIps: z.string().optional(),
    registerEnabled: z.boolean().optional(),
    registerInterval: z.number().int().min(30).max(3600).optional(),
    outboundCallerId: z.string().optional(),
    recordingEnabled: z.boolean().optional(),
    denoiseEnabled: z.boolean().optional(),
  });

const isTransportValue = (value: string | undefined): value is TransportValue =>
  !!value && (TRANSPORT_OPTIONS as readonly string[]).includes(value);

const normalizeTransport = (value?: string): TransportValue =>
  isTransportValue(value) ? value : DEFAULT_TRANSPORT;

interface AgentDto {
  id: string;
  name: string;
}

interface TrunkDto {
  id: string;
  name: string;
  direction: 'inbound' | 'outbound';
  host?: string;
  port: number;
  username?: string;
  password: string;
  transport: 'udp' | 'tcp' | 'tls' | 'wss';
  codecs?: string;
  didNumber?: string;
  agent?: AgentDto | null;
  agentId?: string | null;
  allowedIps?: string;
  registerEnabled: boolean;
  registerInterval: number;
  outboundCallerId?: string;
  recordingEnabled: boolean;
  denoiseEnabled: boolean;
}

type TrunkFormValues = z.infer<ReturnType<typeof makeTrunkSchema>>;

export default function TrunksPage() {
  const { dictionary } = useI18n();
  const { user } = useAuth();
  const trunkSchema = useMemo(() => makeTrunkSchema(dictionary), [dictionary]);
  const [trunks, setTrunks] = useState<TrunkDto[]>([]);
  const [agents, setAgents] = useState<AgentDto[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  });
  const pageSizeOptions = [10, 25, 50];
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTrunk, setEditingTrunk] = useState<TrunkDto | null>(null);
  const [updating, setUpdating] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TrunkDto | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  const isReadOnly = user?.role === 'viewer';
  const transportOptions = TRANSPORT_OPTIONS.map((value) => ({
    value,
    label: dictionary.trunks.transportOptions[value] || value.toUpperCase(),
  }));
  const formatTransport = (value: TrunkDto['transport']) => {
    const labels = dictionary.trunks.transportOptions as Record<string, string>;
    return labels[value] ?? value.toUpperCase();
  };

  const defaultFormValues: TrunkFormValues = {
    name: '',
    direction: 'inbound',
    host: '',
    port: 5060,
    username: '',
    password: '',
    transport: DEFAULT_TRANSPORT,
    codecs: CODECS_DEFAULT,
    didNumber: '',
    agentId: '',
    allowedIps: '',
    registerEnabled: false,
    registerInterval: 120,
    outboundCallerId: '',
    recordingEnabled: false,
    denoiseEnabled: true,
  };

  const form = useForm<TrunkFormValues>({
    resolver: zodResolver(trunkSchema),
    defaultValues: defaultFormValues,
  });

  const editForm = useForm<TrunkFormValues>({
    resolver: zodResolver(trunkSchema),
    defaultValues: defaultFormValues,
  });

  const watchDirection = form.watch('direction');
  const editWatchDirection = editForm.watch('direction');
  const watchRegisterEnabled = form.watch('registerEnabled');
  const editWatchRegisterEnabled = editForm.watch('registerEnabled');

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
    setLoading(true);
    try {
      const data = await apiFetch<PaginatedResponse<TrunkDto>>('/trunks', {
        query: { page: pagination.page, limit: pagination.limit },
        paginated: true,
      });
      setTrunks(data.data);
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
        setError(dictionary.trunks.errors.load);
      }
    } finally {
      setLoading(false);
    }
  }, [dictionary.trunks.errors.load, pagination.limit, pagination.page]);

  useEffect(() => {
    loadTrunks();
    loadAgents();
  }, [loadTrunks, loadAgents]);

  const resetForms = () => {
    form.reset(defaultFormValues);
    editForm.reset(defaultFormValues);
  };

  const onSubmit = async (values: TrunkFormValues) => {
    if (isReadOnly) {
      return;
    }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        name: values.name.trim(),
        direction: values.direction,
        transport: values.transport,
        codecs: values.codecs,
        recordingEnabled: values.recordingEnabled,
        denoiseEnabled: values.denoiseEnabled,
      };

      if (values.direction === 'outbound') {
        body.host = values.host;
        body.port = values.port;
        body.username = values.username;
        if (values.password) {
          body.password = values.password;
        }
        body.registerEnabled = values.registerEnabled;
        body.registerInterval = values.registerInterval;
        body.outboundCallerId = values.outboundCallerId;
      } else {
        body.didNumber = values.didNumber;
        body.agentId = values.agentId || undefined;
        body.allowedIps = values.allowedIps;
      }

      await apiFetch<TrunkDto>('/trunks', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setDialogOpen(false);
      resetForms();
      await loadTrunks();
    } catch (err) {
      if (err instanceof ApiError) {
        form.setError('name', { message: err.message });
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(dictionary.trunks.errors.create);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const openEditDialog = (trunk: TrunkDto) => {
    if (isReadOnly) {
      return;
    }
    setError(null);
    setEditingTrunk(trunk);
    editForm.reset({
      name: trunk.name,
      direction: trunk.direction,
      host: trunk.host || '',
      port: trunk.port || 5060,
      username: trunk.username || '',
      password: '',
      transport: normalizeTransport(trunk.transport),
      codecs: normalizeCodecsValue(trunk.codecs),
      didNumber: trunk.didNumber || '',
      agentId: trunk.agentId || '',
      allowedIps: trunk.allowedIps || '',
      registerEnabled: trunk.registerEnabled,
      registerInterval: trunk.registerInterval || 120,
      outboundCallerId: trunk.outboundCallerId || '',
      recordingEnabled: trunk.recordingEnabled,
      denoiseEnabled: trunk.denoiseEnabled,
    });
    setEditDialogOpen(true);
  };

  const handleUpdate = async (values: TrunkFormValues) => {
    if (!editingTrunk) {
      return;
    }
    if (isReadOnly) {
      return;
    }
    setUpdating(true);
    try {
      const body: Record<string, unknown> = {
        name: values.name.trim(),
        direction: values.direction,
        transport: values.transport,
        codecs: values.codecs,
        recordingEnabled: values.recordingEnabled,
        denoiseEnabled: values.denoiseEnabled,
      };

      if (values.direction === 'outbound') {
        body.host = values.host;
        body.port = values.port;
        body.username = values.username;
        if (values.password) {
          body.password = values.password;
        }
        body.registerEnabled = values.registerEnabled;
        body.registerInterval = values.registerInterval;
        body.outboundCallerId = values.outboundCallerId;
      } else {
        body.didNumber = values.didNumber;
        body.agentId = values.agentId || null;
        body.allowedIps = values.allowedIps;
      }

      await apiFetch<TrunkDto>(`/trunks/${editingTrunk.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      setEditDialogOpen(false);
      setEditingTrunk(null);
      resetForms();
      await loadTrunks();
    } catch (err) {
      if (err instanceof ApiError) {
        editForm.setError('name', { message: err.message });
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(dictionary.trunks.errors.update);
      }
    } finally {
      setUpdating(false);
    }
  };

  const confirmDelete = (trunk: TrunkDto) => {
    if (isReadOnly) {
      return;
    }
    setDeleteTarget(trunk);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async (event?: MouseEvent<HTMLButtonElement>) => {
    event?.preventDefault();
    if (!deleteTarget) {
      return;
    }
    if (isReadOnly) {
      return;
    }
    setDeleting(true);
    try {
      await apiFetch(`/trunks/${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      setDeleteDialogOpen(false);
      await loadTrunks();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(dictionary.trunks.errors.delete);
      }
    } finally {
      setDeleting(false);
    }
  };

  const renderFormFields = (
    formInstance: typeof form | typeof editForm,
    direction: DirectionValue,
    registerEnabled: boolean | undefined,
  ) => (
    <>
      <FormField
        control={formInstance.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{dictionary.trunks.fields.name}</FormLabel>
            <FormControl>
              <Input placeholder="e.g., telnyx-trunk" autoComplete="off" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={formInstance.control}
        name="direction"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{dictionary.trunks.fields.direction}</FormLabel>
            <FormControl>
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger>
                  <SelectValue placeholder={dictionary.trunks.placeholders.direction} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inbound">
                    <div className="flex items-center gap-2">
                      <PhoneIncoming className="h-4 w-4" />
                      {dictionary.trunks.directions.inbound}
                    </div>
                  </SelectItem>
                  <SelectItem value="outbound">
                    <div className="flex items-center gap-2">
                      <PhoneOutgoing className="h-4 w-4" />
                      {dictionary.trunks.directions.outbound}
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {direction === 'outbound' ? (
        <>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={formInstance.control}
              name="host"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{dictionary.trunks.fields.host}</FormLabel>
                  <FormControl>
                    <Input placeholder={dictionary.trunks.placeholders.host} autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={formInstance.control}
              name="port"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{dictionary.trunks.fields.port}</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="5060" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={formInstance.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{dictionary.trunks.fields.username}</FormLabel>
                  <FormControl>
                    <Input placeholder={dictionary.trunks.placeholders.username} autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={formInstance.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{dictionary.trunks.fields.password}</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder={dictionary.trunks.placeholders.password} autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormDescription>{dictionary.trunks.placeholders.passwordHint}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={formInstance.control}
            name="outboundCallerId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{dictionary.trunks.fields.outboundCallerId}</FormLabel>
                <FormControl>
                  <Input placeholder={dictionary.trunks.placeholders.outboundCallerId} autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={formInstance.control}
            name="registerEnabled"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <FormLabel>{dictionary.trunks.fields.registerEnabled}</FormLabel>
                  <FormDescription>{dictionary.trunks.placeholders.registerEnabledHint}</FormDescription>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />

          {registerEnabled && (
            <FormField
              control={formInstance.control}
              name="registerInterval"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{dictionary.trunks.fields.registerInterval}</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="120" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </>
      ) : (
        <>
          <FormField
            control={formInstance.control}
            name="didNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{dictionary.trunks.fields.didNumber}</FormLabel>
                <FormControl>
                  <Input placeholder={dictionary.trunks.placeholders.didNumber} autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={formInstance.control}
            name="agentId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{dictionary.trunks.fields.agent}</FormLabel>
                <FormControl>
                  <Select onValueChange={field.onChange} value={field.value || ''}>
                    <SelectTrigger>
                      <SelectValue placeholder={dictionary.trunks.placeholders.agent} />
                    </SelectTrigger>
                    <SelectContent>
                      {agents.map((agent) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={formInstance.control}
            name="allowedIps"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{dictionary.trunks.fields.allowedIps}</FormLabel>
                <FormControl>
                  <Input placeholder={dictionary.trunks.placeholders.allowedIps} autoComplete="off" {...field} />
                </FormControl>
                <FormDescription>{dictionary.trunks.placeholders.allowedIpsHint}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      )}

      <FormField
        control={formInstance.control}
        name="transport"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{dictionary.trunks.fields.transport}</FormLabel>
            <FormControl>
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger>
                  <SelectValue placeholder={dictionary.trunks.placeholders.transport} />
                </SelectTrigger>
                <SelectContent>
                  {transportOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={formInstance.control}
        name="codecs"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{dictionary.trunks.fields.codecs}</FormLabel>
            <FormControl>
              <Input placeholder={dictionary.trunks.placeholders.codecs} autoComplete="off" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={formInstance.control}
          name="recordingEnabled"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <FormLabel>{dictionary.trunks.fields.recordingEnabled}</FormLabel>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={formInstance.control}
          name="denoiseEnabled"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <FormLabel>{dictionary.trunks.fields.denoiseEnabled}</FormLabel>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
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
          <h1 className="text-2xl font-semibold tracking-tight">{dictionary.trunks.title}</h1>
          <p className="text-sm text-muted-foreground">{dictionary.trunks.subtitle}</p>
        </div>
        {isReadOnly ? (
          <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted px-3 py-2 text-xs text-muted-foreground">
            <Shield className="h-4 w-4" /> {dictionary.trunks.notices.readOnly}
          </div>
        ) : (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" /> {dictionary.trunks.new}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{dictionary.trunks.createTitle}</DialogTitle>
                <DialogDescription>{dictionary.trunks.createDescription}</DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
                  {renderFormFields(form, watchDirection, watchRegisterEnabled)}
                  <DialogFooter>
                    <Button type="submit" disabled={submitting || isReadOnly}>
                      {submitting ? dictionary.trunks.buttons.creating : dictionary.trunks.buttons.create}
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
          <CardTitle>{dictionary.trunks.title}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <CardSkeleton />
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : trunks.length === 0 ? (
            <p className="text-sm text-muted-foreground">{dictionary.common.none}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{dictionary.trunks.table.name}</TableHead>
                    <TableHead>{dictionary.trunks.table.direction}</TableHead>
                    <TableHead>{dictionary.trunks.table.hostOrDid}</TableHead>
                    <TableHead>{dictionary.trunks.table.agent}</TableHead>
                    <TableHead>{dictionary.trunks.table.transport}</TableHead>
                    <TableHead>{dictionary.trunks.table.password}</TableHead>
                    <TableHead className="text-right">{dictionary.trunks.table.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trunks.map((trunk) => (
                    <TableRow key={trunk.id}>
                      <TableCell className="font-medium">{trunk.name}</TableCell>
                      <TableCell>
                        <Badge variant={trunk.direction === 'inbound' ? 'default' : 'secondary'}>
                          {trunk.direction === 'inbound' ? (
                            <PhoneIncoming className="mr-1 h-3 w-3" />
                          ) : (
                            <PhoneOutgoing className="mr-1 h-3 w-3" />
                          )}
                          {dictionary.trunks.directions[trunk.direction]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <code className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
                          {trunk.direction === 'inbound' ? trunk.didNumber || '-' : trunk.host || '-'}
                        </code>
                      </TableCell>
                      <TableCell>
                        {trunk.direction === 'inbound' && trunk.agent ? (
                          <span className="text-sm">{trunk.agent.name}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <code className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
                          {formatTransport(trunk.transport)}
                        </code>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
                            {visiblePasswords[trunk.id] ? trunk.password : '••••••••'}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setVisiblePasswords((prev) => ({
                                ...prev,
                                [trunk.id]: !prev[trunk.id],
                              }))
                            }
                            aria-label={
                              visiblePasswords[trunk.id]
                                ? dictionary.trunks.buttons.hidePassword
                                : dictionary.trunks.buttons.showPassword
                            }
                          >
                            {visiblePasswords[trunk.id] ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => openEditDialog(trunk)}
                            disabled={isReadOnly}
                            aria-label={dictionary.trunks.editTitle}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => confirmDelete(trunk)}
                            disabled={isReadOnly}
                            aria-label={dictionary.trunks.delete.confirm}
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
                labels={dictionary.pagination}
                pageSizeOptions={pageSizeOptions}
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
            <DialogTitle>{dictionary.trunks.editTitle}</DialogTitle>
            <DialogDescription>{dictionary.trunks.editDescription}</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form className="space-y-4" onSubmit={editForm.handleSubmit(handleUpdate)}>
              {renderFormFields(editForm, editWatchDirection, editWatchRegisterEnabled)}
              <DialogFooter>
                <Button type="submit" disabled={updating || isReadOnly}>
                  {updating ? dictionary.trunks.buttons.updating : dictionary.trunks.buttons.update}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => {
        setDeleteDialogOpen(open);
        if (!open) {
          setDeleteTarget(null);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dictionary.trunks.delete.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? dictionary.trunks.delete.description.replace('{name}', deleteTarget.name)
                : dictionary.trunks.delete.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isReadOnly || deleting}>
              {dictionary.common.buttons.cancel}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isReadOnly || deleting}>
              {deleting ? dictionary.trunks.delete.processing : dictionary.trunks.delete.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}

function CardSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, idx) => (
        <Skeleton key={idx} className="h-10 w-full" />
      ))}
    </div>
  );
}
