'use client';

import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react';
import { motion } from 'framer-motion';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Key, Plus, Copy, Ban, Trash2, Check, AlertTriangle } from 'lucide-react';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface ApiKeyDto {
  id: string;
  name: string;
  keyPrefix: string;
  key: string;
  scopes: string[];
  expiresAt?: string | null;
  lastUsedAt?: string | null;
  createdAt: string;
  isActive: boolean;
}

interface ApiKeyCreatedDto extends ApiKeyDto {}

const createApiKeySchema = (dict: ReturnType<typeof useI18n>['dictionary']) =>
  z.object({
    name: z
      .string()
      .min(1, dict.apiKeys?.createDialog?.nameLabel || 'Name is required')
      .max(100),
    scopes: z.array(z.enum(['read', 'write', 'admin'])).min(1, 'Select at least one permission'),
    expiresAt: z.string().optional(),
  });

export default function ApiKeysPage() {
  const { dictionary: t } = useI18n();
  const [apiKeys, setApiKeys] = useState<ApiKeyDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createdKey, setCreatedKey] = useState<ApiKeyCreatedDto | null>(null);
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyDto | null>(null);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ApiKeyDto | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  const createSchema = useMemo(() => createApiKeySchema(t), [t]);

  const form = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      name: '',
      scopes: ['read', 'write'],
      expiresAt: '',
    },
  });

  const loadApiKeys = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiFetch<ApiKeyDto[]>('/api-keys');
      setApiKeys(response);
      setError(null);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(t.apiKeys?.errors?.load || 'Failed to load API keys');
      }
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadApiKeys();
  }, [loadApiKeys]);

  const onSubmit = async (values: z.infer<typeof createSchema>) => {
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        name: values.name,
        scopes: values.scopes,
      };
      if (values.expiresAt) {
        payload.expiresAt = values.expiresAt;
      }

      const response = await apiFetch<ApiKeyCreatedDto>('/api-keys', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setCreatedKey(response);
      setDialogOpen(false);
      form.reset();
      setSuccessDialogOpen(true);
      await loadApiKeys();
    } catch (err) {
      if (err instanceof ApiError) {
        form.setError('name', { message: err.message });
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(t.apiKeys?.errors?.create || 'Failed to create API key');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyKey = async () => {
    if (!createdKey?.key) return;
    try {
      await navigator.clipboard.writeText(createdKey.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = createdKey.key;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyKeyFromTable = async (keyId: string, keyValue: string) => {
    try {
      await navigator.clipboard.writeText(keyValue);
      setCopiedKeyId(keyId);
      setTimeout(() => setCopiedKeyId(null), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = keyValue;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedKeyId(keyId);
      setTimeout(() => setCopiedKeyId(null), 2000);
    }
  };

  const handleRevoke = async (event?: MouseEvent<HTMLButtonElement>) => {
    event?.preventDefault();
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await apiFetch(`/api-keys/${revokeTarget.id}/revoke`, {
        method: 'POST',
      });
      setRevokeTarget(null);
      setRevokeDialogOpen(false);
      await loadApiKeys();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(t.apiKeys?.errors?.revoke || 'Failed to revoke API key');
      }
    } finally {
      setRevoking(false);
    }
  };

  const handleDelete = async (event?: MouseEvent<HTMLButtonElement>) => {
    event?.preventDefault();
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/api-keys/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      setDeleteTarget(null);
      setDeleteDialogOpen(false);
      await loadApiKeys();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(t.apiKeys?.errors?.delete || 'Failed to delete API key');
      }
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return t.apiKeys?.table?.never || 'Never';
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getKeyStatus = (key: ApiKeyDto) => {
    if (!key.isActive) return 'revoked';
    if (key.expiresAt && new Date(key.expiresAt) < new Date()) return 'expired';
    return 'active';
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t.apiKeys?.title || 'API Keys'}</h1>
          <p className="text-sm text-muted-foreground">{t.apiKeys?.description || 'Manage API keys for programmatic access'}</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> {t.apiKeys?.create || 'Create API Key'}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>{t.apiKeys?.createDialog?.title || 'Create API Key'}</DialogTitle>
              <DialogDescription>
                {t.apiKeys?.createDialog?.description || 'Create a new API key for programmatic access'}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.apiKeys?.createDialog?.nameLabel || 'Name'} *</FormLabel>
                      <FormControl>
                        <Input placeholder={t.apiKeys?.createDialog?.namePlaceholder || 'My API Key'} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="scopes"
                  render={() => (
                    <FormItem>
                      <FormLabel>{t.apiKeys?.createDialog?.scopesLabel || 'Permissions'} *</FormLabel>
                      <div className="space-y-2">
                        {['read', 'write', 'admin'].map((scope) => (
                          <FormField
                            key={scope}
                            control={form.control}
                            name="scopes"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(scope as 'read' | 'write' | 'admin')}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...field.value, scope])
                                        : field.onChange(field.value?.filter((value) => value !== scope));
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal capitalize">
                                  {t.apiKeys?.scopes?.[scope as keyof typeof t.apiKeys.scopes] || scope}
                                </FormLabel>
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
                  name="expiresAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.apiKeys?.createDialog?.expirationLabel || 'Expiration (Optional)'}</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormDescription>
                        {t.apiKeys?.createDialog?.expirationHelp || 'Leave empty for no expiration'}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? (t.apiKeys?.createDialog?.creating || 'Creating...') : (t.apiKeys?.createDialog?.submit || 'Create Key')}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            {t.apiKeys?.tableTitle || 'Your API Keys'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <CardSkeleton />
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : apiKeys.length === 0 ? (
            <div className="text-center py-8">
              <Key className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">{t.apiKeys?.empty || 'No API keys yet'}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {t.apiKeys?.emptyDescription || 'Create an API key to access the API programmatically'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.apiKeys?.table?.name || 'Name'}</TableHead>
                    <TableHead>{t.apiKeys?.table?.keyPrefix || 'Key'}</TableHead>
                    <TableHead>{t.apiKeys?.table?.scopes || 'Scopes'}</TableHead>
                    <TableHead>{t.apiKeys?.table?.created || 'Created'}</TableHead>
                    <TableHead>{t.apiKeys?.table?.lastUsed || 'Last Used'}</TableHead>
                    <TableHead>{t.apiKeys?.table?.status || 'Status'}</TableHead>
                    <TableHead className="text-right">{t.apiKeys?.table?.actions || 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apiKeys.map((item) => {
                    const status = getKeyStatus(item);
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="font-mono text-xs text-muted-foreground bg-muted px-2 py-1 rounded max-w-[200px] truncate">
                              {item.key}
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleCopyKeyFromTable(item.id, item.key)}
                              title={t.apiKeys?.actions?.copy || 'Copy'}
                            >
                              {copiedKeyId === item.id ? (
                                <Check className="h-3.5 w-3.5 text-green-500" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {item.scopes.map((scope) => (
                              <Badge key={scope} variant="secondary" className="text-xs capitalize">
                                {scope}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(item.createdAt)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(item.lastUsedAt)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              status === 'active' ? 'default' : status === 'revoked' ? 'destructive' : 'secondary'
                            }
                          >
                            {t.apiKeys?.status?.[status as keyof typeof t.apiKeys.status] || status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {item.isActive && (
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => {
                                  setError(null);
                                  setRevokeTarget(item);
                                  setRevokeDialogOpen(true);
                                }}
                                title={t.apiKeys?.actions?.revoke || 'Revoke'}
                              >
                                <Ban className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="destructive"
                              size="icon"
                              onClick={() => {
                                setError(null);
                                setDeleteTarget(item);
                                setDeleteDialogOpen(true);
                              }}
                              title={t.apiKeys?.actions?.delete || 'Delete'}
                            >
                              <Trash2 className="h-4 w-4" />
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

      {/* Success Dialog - Show created key */}
      <Dialog
        open={successDialogOpen}
        onOpenChange={(open) => {
          setSuccessDialogOpen(open);
          if (!open) {
            setCreatedKey(null);
            setCopied(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-500" />
              {t.apiKeys?.successDialog?.title || 'API Key Created'}
            </DialogTitle>
          </DialogHeader>
          <Alert className="border-green-500 bg-green-500/10">
            <Check className="h-4 w-4 text-green-500" />
            <AlertTitle className="text-green-600">{t.apiKeys?.successDialog?.successTitle || 'Success'}</AlertTitle>
            <AlertDescription className="text-green-600">
              {t.apiKeys?.successDialog?.successMessage || "Your API key has been created. You can copy it anytime from the table below."}
            </AlertDescription>
          </Alert>
          <div className="mt-4">
            <label className="text-sm font-medium">{t.apiKeys?.successDialog?.keyLabel || 'Your API Key'}</label>
            <div className="mt-2 flex items-center gap-2">
              <Input
                readOnly
                value={createdKey?.key || ''}
                className="font-mono text-sm"
              />
              <Button variant="outline" size="icon" onClick={handleCopyKey}>
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            {copied && (
              <p className="mt-2 text-sm text-green-500">
                {t.apiKeys?.successDialog?.copied || 'Copied to clipboard'}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setSuccessDialogOpen(false)}>
              {t.common?.done || 'Done'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Confirmation Dialog */}
      <AlertDialog
        open={revokeDialogOpen}
        onOpenChange={(open) => {
          setRevokeDialogOpen(open);
          if (!open) setRevokeTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.apiKeys?.confirmRevoke?.title || 'Revoke API Key'}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.apiKeys?.confirmRevoke?.description || 'Are you sure you want to revoke this API key? It will no longer work for authentication.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoking}>{t.common?.cancel || 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleRevoke}
              disabled={revoking}
            >
              {revoking ? (t.apiKeys?.confirmRevoke?.processing || 'Revoking...') : (t.apiKeys?.confirmRevoke?.confirm || 'Revoke')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
            <AlertDialogTitle>{t.apiKeys?.confirmDelete?.title || 'Delete API Key'}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.apiKeys?.confirmDelete?.description || 'Are you sure you want to permanently delete this API key?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t.common?.cancel || 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (t.apiKeys?.confirmDelete?.processing || 'Deleting...') : (t.apiKeys?.confirmDelete?.confirm || 'Delete')}
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
      {Array.from({ length: 5 }).map((_, idx) => (
        <Skeleton key={idx} className="h-10 w-full" />
      ))}
    </div>
  );
}
