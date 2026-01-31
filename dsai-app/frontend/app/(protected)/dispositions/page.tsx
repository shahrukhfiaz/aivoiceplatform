'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PlusCircle, Pencil, Trash2, Tag } from 'lucide-react';
import { apiFetch, ApiError, type PaginatedResponse } from '@/lib/api';
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

const dispositionSchema = z.object({
  code: z.string().min(1, 'Code is required').max(20),
  name: z.string().min(2, 'Name must be at least 2 characters').max(50),
  category: z.enum(['positive', 'negative', 'neutral', 'callback']),
  markAsDnc: z.boolean(),
  scheduleCallback: z.boolean(),
  retryAfterMinutes: z.number().optional(),
  sortOrder: z.number(),
});

type DispositionFormValues = z.infer<typeof dispositionSchema>;

interface DispositionDto {
  id: string;
  code: string;
  name: string;
  category: 'positive' | 'negative' | 'neutral' | 'callback';
  isSystem: boolean;
  markAsDnc: boolean;
  scheduleCallback: boolean;
  retryAfterMinutes?: number;
  sortOrder: number;
  createdAt: string;
}

const categoryColors: Record<DispositionDto['category'], string> = {
  positive: 'bg-green-500',
  negative: 'bg-red-500',
  neutral: 'bg-gray-500',
  callback: 'bg-blue-500',
};

export default function DispositionsPage() {
  const { user } = useAuth();
  const [dispositions, setDispositions] = useState<DispositionDto[]>([]);
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
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingDisposition, setEditingDisposition] = useState<DispositionDto | null>(null);
  const [updating, setUpdating] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DispositionDto | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isReadOnly = user?.role === 'viewer';

  const defaultFormValues: DispositionFormValues = {
    code: '',
    name: '',
    category: 'neutral',
    markAsDnc: false,
    scheduleCallback: false,
    retryAfterMinutes: undefined,
    sortOrder: 0,
  };

  const form = useForm<DispositionFormValues>({
    resolver: zodResolver(dispositionSchema),
    defaultValues: defaultFormValues,
  });

  const editForm = useForm<DispositionFormValues>({
    resolver: zodResolver(dispositionSchema),
    defaultValues: defaultFormValues,
  });

  const loadDispositions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<PaginatedResponse<DispositionDto>>('/dispositions', {
        query: { page: pagination.page, limit: pagination.limit },
        paginated: true,
      });
      setDispositions(data.data);
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
        setError('Failed to load dispositions');
      }
    } finally {
      setLoading(false);
    }
  }, [pagination.limit, pagination.page]);

  useEffect(() => {
    loadDispositions();
  }, [loadDispositions]);

  const onSubmit = async (values: DispositionFormValues) => {
    if (isReadOnly) return;
    setSubmitting(true);
    try {
      await apiFetch<DispositionDto>('/dispositions', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      setDialogOpen(false);
      form.reset(defaultFormValues);
      await loadDispositions();
    } catch (err) {
      if (err instanceof ApiError) {
        form.setError('code', { message: err.message });
      } else if (err instanceof Error) {
        setError(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const openEditDialog = (disposition: DispositionDto) => {
    if (isReadOnly) return;
    setEditingDisposition(disposition);
    editForm.reset({
      code: disposition.code,
      name: disposition.name,
      category: disposition.category,
      markAsDnc: disposition.markAsDnc,
      scheduleCallback: disposition.scheduleCallback,
      retryAfterMinutes: disposition.retryAfterMinutes,
      sortOrder: disposition.sortOrder,
    });
    setEditDialogOpen(true);
  };

  const handleUpdate = async (values: DispositionFormValues) => {
    if (!editingDisposition || isReadOnly) return;
    setUpdating(true);
    try {
      await apiFetch<DispositionDto>(`/dispositions/${editingDisposition.id}`, {
        method: 'PATCH',
        body: JSON.stringify(values),
      });
      setEditDialogOpen(false);
      setEditingDisposition(null);
      await loadDispositions();
    } catch (err) {
      if (err instanceof ApiError) {
        editForm.setError('code', { message: err.message });
      }
    } finally {
      setUpdating(false);
    }
  };

  const confirmDelete = (disposition: DispositionDto) => {
    if (isReadOnly || disposition.isSystem) return;
    setDeleteTarget(disposition);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget || isReadOnly) return;
    setDeleting(true);
    try {
      await apiFetch(`/dispositions/${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      setDeleteDialogOpen(false);
      await loadDispositions();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      }
    } finally {
      setDeleting(false);
    }
  };

  const renderFormFields = (formInstance: typeof form, isEdit = false) => (
    <>
      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={formInstance.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Code</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., SALE"
                  {...field}
                  disabled={isEdit && editingDisposition?.isSystem}
                />
              </FormControl>
              <FormDescription>Short code (uppercase)</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={formInstance.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Sale Completed" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={formInstance.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value}
                disabled={isEdit && editingDisposition?.isSystem}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="positive">Positive</SelectItem>
                  <SelectItem value="negative">Negative</SelectItem>
                  <SelectItem value="neutral">Neutral</SelectItem>
                  <SelectItem value="callback">Callback</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={formInstance.control}
          name="sortOrder"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Sort Order</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  {...field}
                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={formInstance.control}
        name="retryAfterMinutes"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Retry After (minutes)</FormLabel>
            <FormControl>
              <Input
                type="number"
                placeholder="e.g., 60"
                {...field}
                value={field.value ?? ''}
                onChange={(e) =>
                  field.onChange(e.target.value ? parseInt(e.target.value) : undefined)
                }
              />
            </FormControl>
            <FormDescription>Auto-retry lead after this many minutes</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="space-y-4">
        <FormField
          control={formInstance.control}
          name="markAsDnc"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <FormLabel>Mark as DNC</FormLabel>
                <FormDescription>Add lead to Do Not Call list</FormDescription>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={formInstance.control}
          name="scheduleCallback"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <FormLabel>Schedule Callback</FormLabel>
                <FormDescription>Prompt to schedule a callback</FormDescription>
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
          <h1 className="text-2xl font-semibold tracking-tight">Dispositions</h1>
          <p className="text-sm text-muted-foreground">
            Manage call outcome codes and their behaviors
          </p>
        </div>
        {!isReadOnly && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" /> New Disposition
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Create Disposition</DialogTitle>
                <DialogDescription>Add a new call disposition code</DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
                  {renderFormFields(form)}
                  <DialogFooter>
                    <Button type="submit" disabled={submitting}>
                      {submitting ? 'Creating...' : 'Create'}
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
            <Tag className="h-5 w-5" />
            All Dispositions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, idx) => (
                <Skeleton key={idx} className="h-10 w-full" />
              ))}
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : dispositions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No dispositions</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Retry</TableHead>
                    <TableHead>DNC</TableHead>
                    <TableHead>Callback</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dispositions.map((disp) => (
                    <TableRow key={disp.id}>
                      <TableCell>
                        <code className="rounded bg-muted px-2 py-1 text-xs font-mono">
                          {disp.code}
                        </code>
                      </TableCell>
                      <TableCell className="font-medium">{disp.name}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`${categoryColors[disp.category]} text-white`}
                        >
                          {disp.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {disp.retryAfterMinutes ? `${disp.retryAfterMinutes}m` : '-'}
                      </TableCell>
                      <TableCell>{disp.markAsDnc ? 'Yes' : '-'}</TableCell>
                      <TableCell>{disp.scheduleCallback ? 'Yes' : '-'}</TableCell>
                      <TableCell>
                        {disp.isSystem ? (
                          <Badge variant="secondary">System</Badge>
                        ) : (
                          <Badge variant="outline">Custom</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => openEditDialog(disp)}
                            disabled={isReadOnly}
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => confirmDelete(disp)}
                            disabled={isReadOnly || disp.isSystem}
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
                  range: 'Showing {start}-{end} of {total} dispositions',
                  zero: '0 dispositions',
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
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Disposition</DialogTitle>
            <DialogDescription>Update disposition settings</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form className="space-y-4" onSubmit={editForm.handleSubmit(handleUpdate)}>
              {renderFormFields(editForm, true)}
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
            <AlertDialogTitle>Delete Disposition</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;?
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
