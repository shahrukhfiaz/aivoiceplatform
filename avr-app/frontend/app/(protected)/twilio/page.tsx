'use client';

import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react';
import { motion } from 'framer-motion';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PlusCircle, Pencil, Trash2, Shield, Eye, EyeOff, Phone, MessageSquare, CheckCircle, XCircle, Loader2, Zap, Radio } from 'lucide-react';
import { apiFetch, ApiError, type PaginatedResponse } from '@/lib/api';
import { useAutoRefresh } from '@/hooks/use-auto-refresh';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

const makeTwilioSchema = (dict: Dictionary) =>
  z.object({
    phoneNumber: z
      .string()
      .min(1, dict.twilio.validation.phoneNumberRequired)
      .regex(/^\+[1-9]\d{1,14}$/, dict.twilio.validation.phoneNumberFormat),
    label: z
      .string()
      .min(2, dict.twilio.validation.labelMin)
      .max(100, dict.twilio.validation.labelMax),
    accountSid: z
      .string()
      .min(1, dict.twilio.validation.accountSidRequired)
      .regex(/^AC[a-f0-9]{32}$/, dict.twilio.validation.accountSidFormat),
    authToken: z.string().optional(),
    connectionType: z.enum(['sip-trunk', 'programmable-voice']),
    smsEnabled: z.boolean(),
    callsEnabled: z.boolean(),
    recordingEnabled: z.boolean(),
    denoiseEnabled: z.boolean(),
    agentId: z.string().optional(),
  });

interface AgentDto {
  id: string;
  name: string;
}

interface TwilioNumberDto {
  id: string;
  phoneNumber: string;
  label: string;
  accountSid: string;
  smsEnabled: boolean;
  callsEnabled: boolean;
  recordingEnabled: boolean;
  denoiseEnabled: boolean;
  agent?: AgentDto | null;
  agentId?: string | null;
  createdAt: string;
  updatedAt: string;
}

type TwilioFormValues = z.infer<ReturnType<typeof makeTwilioSchema>>;

export default function TwilioPage() {
  const { dictionary } = useI18n();
  const { user } = useAuth();
  const twilioSchema = useMemo(() => makeTwilioSchema(dictionary), [dictionary]);
  const [twilioNumbers, setTwilioNumbers] = useState<TwilioNumberDto[]>([]);
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
  const [editingNumber, setEditingNumber] = useState<TwilioNumberDto | null>(null);
  const [updating, setUpdating] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TwilioNumberDto | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [visibleTokens, setVisibleTokens] = useState<Record<string, boolean>>({});
  const [verifying, setVerifying] = useState<Record<string, boolean>>({});
  const [verifyResults, setVerifyResults] = useState<Record<string, { valid: boolean; error?: string }>>({});
  const [fetchingNumbers, setFetchingNumbers] = useState(false);
  const [availableNumbers, setAvailableNumbers] = useState<Array<{ phoneNumber: string; friendlyName: string; capabilities: { voice: boolean; sms: boolean } }>>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const isReadOnly = user?.role === 'viewer';

  const defaultFormValues: TwilioFormValues = {
    phoneNumber: '',
    label: '',
    accountSid: '',
    authToken: '',
    connectionType: 'sip-trunk',
    smsEnabled: false,
    callsEnabled: true,
    recordingEnabled: false,
    denoiseEnabled: true,
    agentId: '',
  };

  const form = useForm<TwilioFormValues>({
    resolver: zodResolver(twilioSchema),
    defaultValues: defaultFormValues,
  });

  const editForm = useForm<TwilioFormValues>({
    resolver: zodResolver(twilioSchema),
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

  const loadTwilioNumbers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<PaginatedResponse<TwilioNumberDto>>('/twilio-numbers', {
        query: { page: pagination.page, limit: pagination.limit },
        paginated: true,
      });
      setTwilioNumbers(data.data);
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
        setError(dictionary.twilio.errors.load);
      }
    } finally {
      setLoading(false);
    }
  }, [dictionary.twilio.errors.load, pagination.limit, pagination.page]);

  useEffect(() => {
    loadTwilioNumbers();
    loadAgents();
  }, [loadTwilioNumbers, loadAgents]);

  // Auto-refresh twilio numbers every 30 seconds, on focus, and on visibility change
  useAutoRefresh({
    refreshFn: loadTwilioNumbers,
    intervalMs: 30000,
    refreshOnFocus: true,
    refreshOnVisibility: true,
  });

  const resetForms = () => {
    form.reset(defaultFormValues);
    editForm.reset(defaultFormValues);
    setAvailableNumbers([]);
    setFetchError(null);
  };

  const fetchAvailableNumbers = async () => {
    const accountSid = form.getValues('accountSid');
    const authToken = form.getValues('authToken');

    if (!accountSid || !authToken) {
      setFetchError('Please enter Account SID and Auth Token first');
      return;
    }

    setFetchingNumbers(true);
    setFetchError(null);
    try {
      const result = await apiFetch<{
        success: boolean;
        numbers?: Array<{ phoneNumber: string; friendlyName: string; capabilities: { voice: boolean; sms: boolean } }>;
        error?: string;
      }>('/twilio-numbers/fetch-numbers', {
        method: 'POST',
        body: JSON.stringify({ accountSid, authToken }),
      });

      if (result.success && result.numbers) {
        setAvailableNumbers(result.numbers);
        if (result.numbers.length === 0) {
          setFetchError('No available phone numbers found in this Twilio account');
        }
      } else {
        setFetchError(result.error || 'Failed to fetch phone numbers');
      }
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to fetch phone numbers');
    } finally {
      setFetchingNumbers(false);
    }
  };

  const onSubmit = async (values: TwilioFormValues) => {
    if (isReadOnly) {
      return;
    }
    setSubmitting(true);
    try {
      if (values.connectionType === 'sip-trunk') {
        // Use the new SIP trunk auto-provisioning endpoint
        await apiFetch('/twilio-numbers/provision-sip', {
          method: 'POST',
          body: JSON.stringify({
            accountSid: values.accountSid.trim(),
            authToken: values.authToken?.trim(),
            phoneNumber: values.phoneNumber.trim(),
            label: values.label.trim(),
            agentId: values.agentId || undefined,
            recordingEnabled: values.recordingEnabled,
            denoiseEnabled: values.denoiseEnabled,
          }),
        });
      } else {
        // Use existing Programmable Voice flow
        const body: Record<string, unknown> = {
          phoneNumber: values.phoneNumber.trim(),
          label: values.label.trim(),
          accountSid: values.accountSid.trim(),
          authToken: values.authToken?.trim(),
          smsEnabled: values.smsEnabled,
          callsEnabled: values.callsEnabled,
          recordingEnabled: values.recordingEnabled,
          denoiseEnabled: values.denoiseEnabled,
          agentId: values.agentId || undefined,
        };

        await apiFetch<TwilioNumberDto>('/twilio-numbers', {
          method: 'POST',
          body: JSON.stringify(body),
        });
      }
      setDialogOpen(false);
      resetForms();
      await loadTwilioNumbers();
    } catch (err) {
      if (err instanceof ApiError) {
        form.setError('phoneNumber', { message: err.message });
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(dictionary.twilio.errors.create);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const openEditDialog = (twilioNumber: TwilioNumberDto) => {
    if (isReadOnly) {
      return;
    }
    setError(null);
    setEditingNumber(twilioNumber);
    editForm.reset({
      phoneNumber: twilioNumber.phoneNumber,
      label: twilioNumber.label,
      accountSid: twilioNumber.accountSid,
      authToken: '',
      smsEnabled: twilioNumber.smsEnabled,
      callsEnabled: twilioNumber.callsEnabled,
      recordingEnabled: twilioNumber.recordingEnabled,
      denoiseEnabled: twilioNumber.denoiseEnabled,
      agentId: twilioNumber.agentId || '',
    });
    setEditDialogOpen(true);
  };

  const handleUpdate = async (values: TwilioFormValues) => {
    if (!editingNumber) {
      return;
    }
    if (isReadOnly) {
      return;
    }
    setUpdating(true);
    try {
      const body: Record<string, unknown> = {
        phoneNumber: values.phoneNumber.trim(),
        label: values.label.trim(),
        accountSid: values.accountSid.trim(),
        smsEnabled: values.smsEnabled,
        callsEnabled: values.callsEnabled,
        recordingEnabled: values.recordingEnabled,
        denoiseEnabled: values.denoiseEnabled,
        agentId: values.agentId || null,
      };

      // Only include authToken if provided
      if (values.authToken) {
        body.authToken = values.authToken.trim();
      }

      await apiFetch<TwilioNumberDto>(`/twilio-numbers/${editingNumber.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      setEditDialogOpen(false);
      setEditingNumber(null);
      resetForms();
      await loadTwilioNumbers();
    } catch (err) {
      if (err instanceof ApiError) {
        editForm.setError('phoneNumber', { message: err.message });
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(dictionary.twilio.errors.update);
      }
    } finally {
      setUpdating(false);
    }
  };

  const confirmDelete = (twilioNumber: TwilioNumberDto) => {
    if (isReadOnly) {
      return;
    }
    setDeleteTarget(twilioNumber);
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
      await apiFetch(`/twilio-numbers/${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      setDeleteDialogOpen(false);
      await loadTwilioNumbers();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(dictionary.twilio.errors.delete);
      }
    } finally {
      setDeleting(false);
    }
  };

  const verifyCredentials = async (id: string) => {
    setVerifying((prev) => ({ ...prev, [id]: true }));
    setVerifyResults((prev) => {
      const newResults = { ...prev };
      delete newResults[id];
      return newResults;
    });
    try {
      const result = await apiFetch<{ valid: boolean; error?: string }>(`/twilio-numbers/${id}/verify`, {
        method: 'POST',
      });
      setVerifyResults((prev) => ({ ...prev, [id]: result }));
    } catch (err) {
      setVerifyResults((prev) => ({
        ...prev,
        [id]: { valid: false, error: err instanceof Error ? err.message : 'Verification failed' },
      }));
    } finally {
      setVerifying((prev) => ({ ...prev, [id]: false }));
    }
  };

  const renderFormFields = (formInstance: typeof form | typeof editForm, isEdit: boolean) => (
    <>
      <FormField
        control={formInstance.control}
        name="accountSid"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{dictionary.twilio.fields.accountSid}</FormLabel>
            <FormControl>
              <Input placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" autoComplete="off" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={formInstance.control}
        name="authToken"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{dictionary.twilio.fields.authToken}</FormLabel>
            <FormControl>
              <Input
                type="password"
                placeholder={isEdit ? dictionary.twilio.placeholders.authTokenEdit : dictionary.twilio.placeholders.authToken}
                autoComplete="new-password"
                {...field}
              />
            </FormControl>
            {isEdit && (
              <FormDescription>{dictionary.twilio.placeholders.authTokenHint}</FormDescription>
            )}
            <FormMessage />
          </FormItem>
        )}
      />

      {!isEdit && (
        <div className="space-y-2">
          <Button
            type="button"
            variant="outline"
            onClick={fetchAvailableNumbers}
            disabled={fetchingNumbers}
            className="w-full"
          >
            {fetchingNumbers ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Fetching numbers...
              </>
            ) : (
              'Fetch Available Numbers from Twilio'
            )}
          </Button>
          {fetchError && (
            <p className="text-sm text-destructive">{fetchError}</p>
          )}
          {availableNumbers.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Found {availableNumbers.length} available number(s)
            </p>
          )}
        </div>
      )}

      <FormField
        control={formInstance.control}
        name="phoneNumber"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{dictionary.twilio.fields.phoneNumber}</FormLabel>
            <FormControl>
              {!isEdit && availableNumbers.length > 0 ? (
                <Select
                  onValueChange={(value) => {
                    field.onChange(value);
                    // Auto-fill label with friendly name
                    const selectedNumber = availableNumbers.find(n => n.phoneNumber === value);
                    if (selectedNumber && !formInstance.getValues('label')) {
                      formInstance.setValue('label', selectedNumber.friendlyName || value);
                    }
                  }}
                  value={field.value}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a phone number" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableNumbers.map((num) => (
                      <SelectItem key={num.phoneNumber} value={num.phoneNumber}>
                        <div className="flex items-center gap-2">
                          <span>{num.phoneNumber}</span>
                          {num.friendlyName !== num.phoneNumber && (
                            <span className="text-muted-foreground">({num.friendlyName})</span>
                          )}
                          <div className="flex gap-1 ml-2">
                            {num.capabilities.voice && (
                              <Badge variant="outline" className="text-[10px] px-1">Voice</Badge>
                            )}
                            {num.capabilities.sms && (
                              <Badge variant="outline" className="text-[10px] px-1">SMS</Badge>
                            )}
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input placeholder="+14156021922" autoComplete="off" {...field} />
              )}
            </FormControl>
            <FormDescription>{dictionary.twilio.placeholders.phoneNumberHint}</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={formInstance.control}
        name="label"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{dictionary.twilio.fields.label}</FormLabel>
            <FormControl>
              <Input placeholder={dictionary.twilio.placeholders.label} autoComplete="off" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {!isEdit && (
        <FormField
          control={formInstance.control}
          name="connectionType"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel>Connection Type</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  value={field.value}
                  className="flex flex-col space-y-2"
                >
                  <div className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="sip-trunk" id="sip-trunk" className="mt-1" />
                    <Label htmlFor="sip-trunk" className="cursor-pointer flex-1">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-green-500" />
                        <span className="font-medium">SIP Trunk (Recommended)</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Lower latency (~50ms), unified recording via Asterisk MixMonitor.
                        Auto-configures Twilio Elastic SIP Trunking.
                      </p>
                    </Label>
                  </div>
                  <div className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="programmable-voice" id="programmable-voice" className="mt-1" />
                    <Label htmlFor="programmable-voice" className="cursor-pointer flex-1">
                      <div className="flex items-center gap-2">
                        <Radio className="h-4 w-4 text-blue-500" />
                        <span className="font-medium">Programmable Voice</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Media Streams via WebSocket (~200ms latency).
                        Uses TwiML webhooks for call handling.
                      </p>
                    </Label>
                  </div>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      <FormField
        control={formInstance.control}
        name="agentId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{dictionary.twilio.fields.agent}</FormLabel>
            <FormControl>
              <Select
                onValueChange={(value) => field.onChange(value === 'none' ? '' : value)}
                value={field.value || 'none'}
              >
                <SelectTrigger>
                  <SelectValue placeholder={dictionary.twilio.placeholders.agent} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{dictionary.twilio.placeholders.noAgent}</SelectItem>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormControl>
            <FormDescription>{dictionary.twilio.placeholders.agentHint}</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={formInstance.control}
          name="callsEnabled"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <FormLabel>{dictionary.twilio.fields.callsEnabled}</FormLabel>
                <FormDescription className="text-xs">{dictionary.twilio.placeholders.callsEnabledHint}</FormDescription>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={formInstance.control}
          name="smsEnabled"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <FormLabel>{dictionary.twilio.fields.smsEnabled}</FormLabel>
                <FormDescription className="text-xs">{dictionary.twilio.placeholders.smsEnabledHint}</FormDescription>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={formInstance.control}
          name="recordingEnabled"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <FormLabel>{dictionary.twilio.fields.recordingEnabled}</FormLabel>
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
                <FormLabel>{dictionary.twilio.fields.denoiseEnabled}</FormLabel>
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
          <h1 className="text-2xl font-semibold tracking-tight">{dictionary.twilio.title}</h1>
          <p className="text-sm text-muted-foreground">{dictionary.twilio.subtitle}</p>
        </div>
        {isReadOnly ? (
          <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted px-3 py-2 text-xs text-muted-foreground">
            <Shield className="h-4 w-4" /> {dictionary.twilio.notices.readOnly}
          </div>
        ) : (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" /> {dictionary.twilio.new}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{dictionary.twilio.createTitle}</DialogTitle>
                <DialogDescription>{dictionary.twilio.createDescription}</DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
                  {renderFormFields(form, false)}
                  <DialogFooter>
                    <Button type="submit" disabled={submitting || isReadOnly}>
                      {submitting ? dictionary.twilio.buttons.creating : dictionary.twilio.buttons.create}
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
          <CardTitle>{dictionary.twilio.title}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <CardSkeleton />
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : twilioNumbers.length === 0 ? (
            <p className="text-sm text-muted-foreground">{dictionary.common.none}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{dictionary.twilio.table.phoneNumber}</TableHead>
                    <TableHead>{dictionary.twilio.table.label}</TableHead>
                    <TableHead>{dictionary.twilio.table.features}</TableHead>
                    <TableHead>{dictionary.twilio.table.agent}</TableHead>
                    <TableHead>{dictionary.twilio.table.status}</TableHead>
                    <TableHead className="text-right">{dictionary.twilio.table.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {twilioNumbers.map((twilioNumber) => (
                    <TableRow key={twilioNumber.id}>
                      <TableCell className="font-medium">
                        <code className="rounded bg-muted px-2 py-1 text-sm">
                          {twilioNumber.phoneNumber}
                        </code>
                      </TableCell>
                      <TableCell>{twilioNumber.label}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {twilioNumber.callsEnabled && (
                            <Badge variant="default" className="text-xs">
                              <Phone className="mr-1 h-3 w-3" />
                              {dictionary.twilio.features.calls}
                            </Badge>
                          )}
                          {twilioNumber.smsEnabled && (
                            <Badge variant="secondary" className="text-xs">
                              <MessageSquare className="mr-1 h-3 w-3" />
                              {dictionary.twilio.features.sms}
                            </Badge>
                          )}
                          {twilioNumber.recordingEnabled && (
                            <Badge variant="outline" className="text-xs">
                              {dictionary.twilio.features.recording}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {twilioNumber.agent ? (
                          <span className="text-sm">{twilioNumber.agent.name}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {verifying[twilioNumber.id] ? (
                          <Badge variant="outline" className="text-xs">
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            {dictionary.twilio.buttons.verifying}
                          </Badge>
                        ) : verifyResults[twilioNumber.id] ? (
                          verifyResults[twilioNumber.id].valid ? (
                            <Badge variant="default" className="text-xs bg-green-600">
                              <CheckCircle className="mr-1 h-3 w-3" />
                              {dictionary.twilio.status.valid}
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-xs">
                              <XCircle className="mr-1 h-3 w-3" />
                              {dictionary.twilio.status.invalid}
                            </Badge>
                          )
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => verifyCredentials(twilioNumber.id)}
                            disabled={isReadOnly}
                          >
                            {dictionary.twilio.buttons.verify}
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => openEditDialog(twilioNumber)}
                            disabled={isReadOnly}
                            aria-label={dictionary.twilio.editTitle}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => confirmDelete(twilioNumber)}
                            disabled={isReadOnly}
                            aria-label={dictionary.twilio.delete.confirm}
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
            <DialogTitle>{dictionary.twilio.editTitle}</DialogTitle>
            <DialogDescription>{dictionary.twilio.editDescription}</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form className="space-y-4" onSubmit={editForm.handleSubmit(handleUpdate)}>
              {renderFormFields(editForm, true)}
              <DialogFooter>
                <Button type="submit" disabled={updating || isReadOnly}>
                  {updating ? dictionary.twilio.buttons.updating : dictionary.twilio.buttons.update}
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
            <AlertDialogTitle>{dictionary.twilio.delete.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? dictionary.twilio.delete.description.replace('{phoneNumber}', deleteTarget.phoneNumber)
                : dictionary.twilio.delete.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isReadOnly || deleting}>
              {dictionary.common.buttons.cancel}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isReadOnly || deleting}>
              {deleting ? dictionary.twilio.delete.processing : dictionary.twilio.delete.confirm}
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
