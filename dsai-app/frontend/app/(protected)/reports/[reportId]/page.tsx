'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Play,
  Download,
  Save,
  Settings,
  Columns,
  Filter,
  Calendar,
  Plus,
  Trash2,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Clock,
  Eye,
  EyeOff,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

interface ReportColumn {
  id: string;
  field: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  aggregation?: 'count' | 'sum' | 'avg' | 'min' | 'max';
  visible: boolean;
  sortable: boolean;
  sortOrder?: 'asc' | 'desc';
  sortPriority?: number;
}

interface ReportFilter {
  id: string;
  field: string;
  operator: string;
  value: unknown;
  label?: string;
}

interface Report {
  id: string;
  name: string;
  description?: string;
  type: string;
  primaryEntity: string;
  columns: ReportColumn[];
  filters?: ReportFilter[];
  dateField?: string;
  defaultDateRange: string;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ReportResult {
  columns: ReportColumn[];
  rows: Record<string, unknown>[];
  totalRows: number;
  page: number;
  pageSize: number;
  executionId: string;
}

const AVAILABLE_FIELDS: Record<string, { name: string; type: string }[]> = {
  call: [
    { name: 'id', type: 'string' },
    { name: 'callId', type: 'string' },
    { name: 'direction', type: 'string' },
    { name: 'status', type: 'string' },
    { name: 'fromNumber', type: 'string' },
    { name: 'toNumber', type: 'string' },
    { name: 'duration', type: 'number' },
    { name: 'createdAt', type: 'date' },
    { name: 'answeredAt', type: 'date' },
    { name: 'endedAt', type: 'date' },
  ],
  lead: [
    { name: 'id', type: 'string' },
    { name: 'firstName', type: 'string' },
    { name: 'lastName', type: 'string' },
    { name: 'phoneNumber', type: 'string' },
    { name: 'email', type: 'string' },
    { name: 'city', type: 'string' },
    { name: 'state', type: 'string' },
    { name: 'zipCode', type: 'string' },
    { name: 'status', type: 'string' },
    { name: 'dialAttempts', type: 'number' },
    { name: 'createdAt', type: 'date' },
    { name: 'lastDialedAt', type: 'date' },
  ],
  campaign: [
    { name: 'id', type: 'string' },
    { name: 'name', type: 'string' },
    { name: 'status', type: 'string' },
    { name: 'dialingMode', type: 'string' },
    { name: 'createdAt', type: 'date' },
  ],
};

const DATE_RANGES = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last_7_days', label: 'Last 7 Days' },
  { value: 'last_30_days', label: 'Last 30 Days' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'custom', label: 'Custom Range' },
];

const FILTER_OPERATORS = [
  { value: 'eq', label: 'Equals' },
  { value: 'neq', label: 'Not Equals' },
  { value: 'gt', label: 'Greater Than' },
  { value: 'gte', label: 'Greater or Equal' },
  { value: 'lt', label: 'Less Than' },
  { value: 'lte', label: 'Less or Equal' },
  { value: 'like', label: 'Contains' },
  { value: 'in', label: 'In List' },
];

export default function ReportDetailPage() {
  const router = useRouter();
  const params = useParams();
  const reportId = params.reportId as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [results, setResults] = useState<ReportResult | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Runtime parameters
  const [dateRange, setDateRange] = useState('last_7_days');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);

  // Add column dialog
  const [addColumnDialogOpen, setAddColumnDialogOpen] = useState(false);
  const [newColumn, setNewColumn] = useState({
    field: '',
    label: '',
    aggregation: '',
  });

  // Add filter dialog
  const [addFilterDialogOpen, setAddFilterDialogOpen] = useState(false);
  const [newFilter, setNewFilter] = useState({
    field: '',
    operator: 'eq',
    value: '',
  });

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<Report>(`/reports/${reportId}`);
      setReport(data);
      setDateRange(data.defaultDateRange);
    } catch (err) {
      console.error('Failed to fetch report:', err);
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleSave = async () => {
    if (!report) return;
    setSaving(true);
    try {
      await apiFetch(`/reports/${reportId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: report.name,
          description: report.description,
          columns: report.columns,
          filters: report.filters,
          dateField: report.dateField,
          defaultDateRange: dateRange,
        }),
      });
      setHasChanges(false);
    } catch (err) {
      console.error('Failed to save report:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleRun = async () => {
    if (!report) return;
    setRunning(true);
    try {
      const body: Record<string, unknown> = {
        page,
        pageSize,
      };

      if (dateRange !== 'custom') {
        // Backend will interpret date range
        body.dateRange = getDateRangeValues(dateRange);
      } else if (customStart && customEnd) {
        body.dateRange = {
          start: customStart,
          end: customEnd,
        };
      }

      const data = await apiFetch<ReportResult>(`/reports/${reportId}/run`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setResults(data);
    } catch (err) {
      console.error('Failed to run report:', err);
    } finally {
      setRunning(false);
    }
  };

  const handleExport = async (format: 'csv' | 'excel' | 'json') => {
    try {
      const body: Record<string, unknown> = { format };

      if (dateRange !== 'custom') {
        body.dateRange = getDateRangeValues(dateRange);
      } else if (customStart && customEnd) {
        body.dateRange = { start: customStart, end: customEnd };
      }

      const result = await apiFetch<{ downloadUrl: string }>(`/reports/${reportId}/export`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      window.open(result.downloadUrl, '_blank');
    } catch (err) {
      console.error('Failed to export report:', err);
    }
  };

  const getDateRangeValues = (range: string): { start: string; end: string } => {
    const now = new Date();
    let start: Date;
    let end: Date = now;

    switch (range) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'yesterday':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
        break;
      case 'last_7_days':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'last_30_days':
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'this_month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'last_month':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        break;
      default:
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    return {
      start: start.toISOString(),
      end: end.toISOString(),
    };
  };

  const updateColumn = (index: number, updates: Partial<ReportColumn>) => {
    if (!report) return;
    const newColumns = [...report.columns];
    newColumns[index] = { ...newColumns[index], ...updates };
    setReport({ ...report, columns: newColumns });
    setHasChanges(true);
  };

  const removeColumn = (index: number) => {
    if (!report) return;
    const newColumns = report.columns.filter((_, i) => i !== index);
    setReport({ ...report, columns: newColumns });
    setHasChanges(true);
  };

  const moveColumn = (index: number, direction: 'up' | 'down') => {
    if (!report) return;
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= report.columns.length) return;

    const newColumns = [...report.columns];
    [newColumns[index], newColumns[newIndex]] = [newColumns[newIndex], newColumns[index]];
    setReport({ ...report, columns: newColumns });
    setHasChanges(true);
  };

  const addColumn = () => {
    if (!report || !newColumn.field) return;
    const fieldDef = AVAILABLE_FIELDS[report.primaryEntity]?.find((f) => f.name === newColumn.field);
    if (!fieldDef) return;

    const column: ReportColumn = {
      id: `col_${Date.now()}`,
      field: newColumn.field,
      label: newColumn.label || newColumn.field,
      type: fieldDef.type as ReportColumn['type'],
      aggregation: newColumn.aggregation as ReportColumn['aggregation'] || undefined,
      visible: true,
      sortable: true,
    };

    setReport({ ...report, columns: [...report.columns, column] });
    setHasChanges(true);
    setAddColumnDialogOpen(false);
    setNewColumn({ field: '', label: '', aggregation: '' });
  };

  const addFilter = () => {
    if (!report || !newFilter.field) return;

    const filter: ReportFilter = {
      id: `filter_${Date.now()}`,
      field: newFilter.field,
      operator: newFilter.operator,
      value: newFilter.value,
    };

    setReport({ ...report, filters: [...(report.filters || []), filter] });
    setHasChanges(true);
    setAddFilterDialogOpen(false);
    setNewFilter({ field: '', operator: 'eq', value: '' });
  };

  const removeFilter = (index: number) => {
    if (!report) return;
    const newFilters = (report.filters || []).filter((_, i) => i !== index);
    setReport({ ...report, filters: newFilters });
    setHasChanges(true);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="text-center py-12">
        <p>Report not found</p>
        <Button variant="link" onClick={() => router.push('/reports')}>
          Back to Reports
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/reports')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <Input
            value={report.name}
            onChange={(e) => {
              setReport({ ...report, name: e.target.value });
              setHasChanges(true);
            }}
            className="text-xl font-semibold border-none p-0 h-auto focus-visible:ring-0"
            disabled={report.isSystem}
          />
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline">{report.type}</Badge>
            {report.isSystem && <Badge variant="secondary">System</Badge>}
          </div>
        </div>
        <div className="flex gap-2">
          {hasChanges && (
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
          )}
          <Button variant="outline" onClick={() => handleExport('csv')}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={handleRun} disabled={running}>
            <Play className="h-4 w-4 mr-2" />
            {running ? 'Running...' : 'Run Report'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration Panel */}
        <div className="space-y-4">
          {/* Date Range */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Date Range
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATE_RANGES.map((range) => (
                    <SelectItem key={range.value} value={range.value}>
                      {range.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {dateRange === 'custom' && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Start</Label>
                    <Input
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">End</Label>
                    <Input
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Columns */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Columns className="h-4 w-4" />
                  Columns
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAddColumnDialogOpen(true)}
                  disabled={report.isSystem}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {report.columns.map((column, index) => (
                  <div
                    key={column.id}
                    className="flex items-center gap-2 p-2 border rounded-md bg-muted/30"
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                    <Checkbox
                      checked={column.visible}
                      onCheckedChange={(checked) =>
                        updateColumn(index, { visible: !!checked })
                      }
                    />
                    <span className="flex-1 text-sm truncate">{column.label}</span>
                    {!report.isSystem && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => moveColumn(index, 'up')}
                          disabled={index === 0}
                        >
                          <ChevronUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => moveColumn(index, 'down')}
                          disabled={index === report.columns.length - 1}
                        >
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive"
                          onClick={() => removeColumn(index)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Filters */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filters
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAddFilterDialogOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {(!report.filters || report.filters.length === 0) ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No filters applied
                </p>
              ) : (
                <div className="space-y-2">
                  {report.filters.map((filter, index) => (
                    <div
                      key={filter.id}
                      className="flex items-center gap-2 p-2 border rounded-md bg-muted/30"
                    >
                      <span className="flex-1 text-sm">
                        {filter.field} {filter.operator} {String(filter.value)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        onClick={() => removeFilter(index)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Results</CardTitle>
              {results && (
                <CardDescription>
                  Showing {results.rows.length} of {results.totalRows} records
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {!results ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Play className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>Click "Run Report" to see results</p>
                </div>
              ) : results.rows.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No data found for the selected criteria</p>
                </div>
              ) : (
                <div className="overflow-auto max-h-[600px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {report.columns
                          .filter((c) => c.visible)
                          .map((column) => (
                            <TableHead key={column.id}>{column.label}</TableHead>
                          ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.rows.map((row, rowIndex) => (
                        <TableRow key={rowIndex}>
                          {report.columns
                            .filter((c) => c.visible)
                            .map((column) => (
                              <TableCell key={column.id}>
                                {formatValue(row[column.label], column.type)}
                              </TableCell>
                            ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Column Dialog */}
      <Dialog open={addColumnDialogOpen} onOpenChange={setAddColumnDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Column</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Field</Label>
              <Select
                value={newColumn.field}
                onValueChange={(value) => setNewColumn({ ...newColumn, field: value, label: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select field..." />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_FIELDS[report.primaryEntity]?.map((field) => (
                    <SelectItem key={field.name} value={field.name}>
                      {field.name} ({field.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Label</Label>
              <Input
                value={newColumn.label}
                onChange={(e) => setNewColumn({ ...newColumn, label: e.target.value })}
                placeholder="Column header label"
              />
            </div>
            <div className="space-y-2">
              <Label>Aggregation (Optional)</Label>
              <Select
                value={newColumn.aggregation}
                onValueChange={(value) => setNewColumn({ ...newColumn, aggregation: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  <SelectItem value="count">Count</SelectItem>
                  <SelectItem value="sum">Sum</SelectItem>
                  <SelectItem value="avg">Average</SelectItem>
                  <SelectItem value="min">Minimum</SelectItem>
                  <SelectItem value="max">Maximum</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddColumnDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={addColumn} disabled={!newColumn.field}>
              Add Column
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Filter Dialog */}
      <Dialog open={addFilterDialogOpen} onOpenChange={setAddFilterDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Filter</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Field</Label>
              <Select
                value={newFilter.field}
                onValueChange={(value) => setNewFilter({ ...newFilter, field: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select field..." />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_FIELDS[report.primaryEntity]?.map((field) => (
                    <SelectItem key={field.name} value={field.name}>
                      {field.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Operator</Label>
              <Select
                value={newFilter.operator}
                onValueChange={(value) => setNewFilter({ ...newFilter, operator: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FILTER_OPERATORS.map((op) => (
                    <SelectItem key={op.value} value={op.value}>
                      {op.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Value</Label>
              <Input
                value={String(newFilter.value)}
                onChange={(e) => setNewFilter({ ...newFilter, value: e.target.value })}
                placeholder="Filter value"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddFilterDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={addFilter} disabled={!newFilter.field || !newFilter.value}>
              Add Filter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatValue(value: unknown, type: string): string {
  if (value === null || value === undefined) return '-';

  switch (type) {
    case 'date':
      return new Date(value as string).toLocaleString();
    case 'number':
      return typeof value === 'number' ? value.toLocaleString() : String(value);
    case 'boolean':
      return value ? 'Yes' : 'No';
    default:
      return String(value);
  }
}
