'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  PlusCircle,
  Trash2,
  Ban,
  Upload,
  Download,
  Search,
  AlertTriangle,
  FileUp,
} from 'lucide-react';
import { apiFetch, ApiError, type PaginatedResponse } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TablePagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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

const dncEntrySchema = z.object({
  phoneNumber: z.string().min(10, 'Phone number must be at least 10 digits'),
  source: z.enum(['internal', 'national', 'state', 'disposition', 'customer_request', 'import']).optional(),
  reason: z.string().optional(),
  campaignId: z.string().optional(),
  expiresAt: z.string().optional(),
});

type DncEntryFormValues = z.infer<typeof dncEntrySchema>;

type DncSource = 'internal' | 'national' | 'state' | 'disposition' | 'customer_request' | 'import';

interface DncEntryDto {
  id: string;
  phoneNumber: string;
  source: DncSource;
  reason?: string | null;
  campaignId?: string | null;
  addedByUserId?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DncStats {
  total: number;
  bySource: Record<string, number>;
}

interface CampaignDto {
  id: string;
  name: string;
}

const sourceColors: Record<DncSource, string> = {
  internal: 'bg-blue-500',
  national: 'bg-red-500',
  state: 'bg-orange-500',
  disposition: 'bg-purple-500',
  customer_request: 'bg-green-500',
  import: 'bg-gray-500',
};

const sourceLabels: Record<DncSource, string> = {
  internal: 'Internal',
  national: 'National DNC',
  state: 'State DNC',
  disposition: 'Disposition',
  customer_request: 'Customer Request',
  import: 'Imported',
};

export default function DncPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<DncEntryDto[]>([]);
  const [stats, setStats] = useState<DncStats | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignDto[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DncEntryDto | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [filterCampaign, setFilterCampaign] = useState<string>('global');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isReadOnly = user?.role === 'viewer';

  const defaultFormValues: DncEntryFormValues = {
    phoneNumber: '',
    source: 'internal',
    reason: '',
    campaignId: undefined,
    expiresAt: undefined,
  };

  const form = useForm<DncEntryFormValues>({
    resolver: zodResolver(dncEntrySchema),
    defaultValues: defaultFormValues,
  });

  const loadCampaigns = useCallback(async () => {
    try {
      const data = await apiFetch<PaginatedResponse<CampaignDto>>('/campaigns', {
        query: { limit: 100 },
        paginated: true,
      });
      setCampaigns(data.data);
    } catch {
      // Silent fail - campaigns are optional
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const campaignId = filterCampaign !== 'global' ? filterCampaign : undefined;
      const data = await apiFetch<DncStats>('/dnc/stats', {
        query: campaignId ? { campaignId } : {},
      });
      setStats(data);
    } catch {
      // Silent fail
    }
  }, [filterCampaign]);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const query: Record<string, string | number> = {
        page: pagination.page,
        limit: pagination.limit,
      };

      if (searchQuery) {
        query.search = searchQuery;
      }

      if (filterSource !== 'all') {
        query.source = filterSource;
      }

      if (filterCampaign !== 'global') {
        query.campaignId = filterCampaign;
      }

      const data = await apiFetch<PaginatedResponse<DncEntryDto>>('/dnc', {
        query,
        paginated: true,
      });
      setEntries(data.data);
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
        setError('Failed to load DNC entries');
      }
    } finally {
      setLoading(false);
    }
  }, [pagination.limit, pagination.page, searchQuery, filterSource, filterCampaign]);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  useEffect(() => {
    loadEntries();
    loadStats();
  }, [loadEntries, loadStats]);

  const onSubmit = async (values: DncEntryFormValues) => {
    if (isReadOnly) return;
    setSubmitting(true);
    try {
      await apiFetch<DncEntryDto>('/dnc', {
        method: 'POST',
        body: JSON.stringify({
          ...values,
          campaignId: values.campaignId || undefined,
        }),
      });
      setDialogOpen(false);
      form.reset(defaultFormValues);
      await loadEntries();
      await loadStats();
    } catch (err) {
      if (err instanceof ApiError) {
        form.setError('phoneNumber', { message: err.message });
      } else if (err instanceof Error) {
        setError(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleImport = async () => {
    if (!importFile || isReadOnly) return;
    setImporting(true);

    try {
      const text = await importFile.text();
      const lines = text.split('\n').filter((line) => line.trim());

      // Skip header if present
      const hasHeader = lines[0]?.toLowerCase().includes('phone');
      const dataLines = hasHeader ? lines.slice(1) : lines;

      const entries = dataLines.map((line) => {
        const parts = line.split(',');
        return {
          phoneNumber: parts[0]?.trim() || '',
          reason: parts[1]?.trim() || undefined,
        };
      }).filter((e) => e.phoneNumber);

      if (entries.length === 0) {
        setError('No valid phone numbers found in file');
        return;
      }

      await apiFetch('/dnc/bulk', {
        method: 'POST',
        body: JSON.stringify({
          entries,
          source: 'import',
          campaignId: filterCampaign !== 'global' ? filterCampaign : undefined,
        }),
      });

      setImportDialogOpen(false);
      setImportFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      await loadEntries();
      await loadStats();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      }
    } finally {
      setImporting(false);
    }
  };

  const handleExport = async () => {
    try {
      const campaignId = filterCampaign !== 'global' ? filterCampaign : undefined;
      const data = await apiFetch<DncEntryDto[]>('/dnc/export', {
        query: campaignId ? { campaignId } : {},
      });

      const csv = [
        'Phone Number,Source,Reason,Added At',
        ...data.map((e) =>
          `${e.phoneNumber},${e.source},${e.reason || ''},${e.createdAt}`
        ),
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dnc-list-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      }
    }
  };

  const confirmDelete = (entry: DncEntryDto) => {
    if (isReadOnly) return;
    setDeleteTarget(entry);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget || isReadOnly) return;
    setDeleting(true);
    try {
      await apiFetch(`/dnc/${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      setDeleteDialogOpen(false);
      await loadEntries();
      await loadStats();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      }
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Do Not Call List</h1>
          <p className="text-sm text-muted-foreground">
            Manage phone numbers that should not be contacted
          </p>
        </div>
        <div className="flex gap-2">
          {!isReadOnly && (
            <>
              <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Upload className="mr-2 h-4 w-4" /> Import CSV
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Import DNC List</DialogTitle>
                    <DialogDescription>
                      Upload a CSV file with phone numbers. First column should be phone numbers.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6">
                      <FileUp className="mb-2 h-8 w-8 text-muted-foreground" />
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,.txt"
                        className="mb-2"
                        onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                      />
                      {importFile && (
                        <p className="text-sm text-muted-foreground">
                          Selected: {importFile.name}
                        </p>
                      )}
                    </div>
                    <div className="rounded-lg bg-yellow-50 p-3 dark:bg-yellow-900/20">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-5 w-5 text-yellow-600" />
                        <div className="text-sm text-yellow-800 dark:text-yellow-200">
                          CSV format: phone_number,reason (reason is optional)
                        </div>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={handleImport}
                      disabled={!importFile || importing}
                    >
                      {importing ? 'Importing...' : 'Import'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Number
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Add to DNC List</DialogTitle>
                    <DialogDescription>
                      Add a phone number to the Do Not Call list
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...form}>
                    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
                      <FormField
                        control={form.control}
                        name="phoneNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone Number</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., 5551234567" {...field} />
                            </FormControl>
                            <FormDescription>Enter phone number (digits only)</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="source"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Source</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select source" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="internal">Internal</SelectItem>
                                <SelectItem value="customer_request">Customer Request</SelectItem>
                                <SelectItem value="national">National DNC</SelectItem>
                                <SelectItem value="state">State DNC</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="reason"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Reason (Optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., Customer requested removal" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="campaignId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Campaign (Optional)</FormLabel>
                            <Select onValueChange={(val) => field.onChange(val === '_global' ? undefined : val)} value={field.value || '_global'}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Global (all campaigns)" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="_global">Global (all campaigns)</SelectItem>
                                {campaigns.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>
                                    {c.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Leave empty for global DNC, or select a specific campaign
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <DialogFooter>
                        <Button type="submit" disabled={submitting}>
                          {submitting ? 'Adding...' : 'Add to DNC'}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </>
          )}
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Blocked</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total.toLocaleString()}</div>
            </CardContent>
          </Card>
          {Object.entries(stats.bySource).slice(0, 3).map(([source, count]) => (
            <Card key={source}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  {sourceLabels[source as DncSource] || source}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{count.toLocaleString()}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ban className="h-5 w-5" />
            DNC Entries
          </CardTitle>
          <CardDescription>
            Phone numbers that will be automatically skipped during dialing
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="mb-4 flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search phone number..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                  className="pl-9"
                />
              </div>
            </div>
            <Select
              value={filterSource}
              onValueChange={(v) => {
                setFilterSource(v);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="internal">Internal</SelectItem>
                <SelectItem value="national">National DNC</SelectItem>
                <SelectItem value="state">State DNC</SelectItem>
                <SelectItem value="disposition">Disposition</SelectItem>
                <SelectItem value="customer_request">Customer Request</SelectItem>
                <SelectItem value="import">Imported</SelectItem>
              </SelectContent>
            </Select>
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
                <SelectItem value="global">Global DNC</SelectItem>
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
                <Skeleton key={idx} className="h-10 w-full" />
              ))}
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Ban className="mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-lg font-medium">No DNC Entries</p>
              <p className="text-sm text-muted-foreground">
                {searchQuery
                  ? 'No entries match your search'
                  : 'Add phone numbers to prevent them from being called'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Phone Number</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <code className="rounded bg-muted px-2 py-1 text-sm font-mono">
                          {entry.phoneNumber}
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`${sourceColors[entry.source]} text-white`}
                        >
                          {sourceLabels[entry.source]}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {entry.reason || '-'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(entry.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {entry.expiresAt ? formatDate(entry.expiresAt) : 'Never'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() => confirmDelete(entry)}
                          disabled={isReadOnly}
                          title="Remove from DNC"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
                  range: 'Showing {start}-{end} of {total} entries',
                  zero: '0 entries',
                  of: 'of',
                  prev: 'Previous',
                  next: 'Next',
                  perPage: 'per page',
                }}
                pageSizeOptions={[10, 25, 50, 100]}
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from DNC List</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {deleteTarget?.phoneNumber} from the DNC list?
              This number will be eligible for dialing again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Removing...' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
