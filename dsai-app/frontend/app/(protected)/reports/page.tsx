'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Copy,
  Play,
  Download,
  Calendar,
  RefreshCw,
  Clock,
  BarChart3,
  Table as TableIcon,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useRouter } from 'next/navigation';

type ReportType = 'campaign' | 'agent' | 'lead' | 'call' | 'disposition' | 'custom';

interface Report {
  id: string;
  name: string;
  description?: string;
  type: ReportType;
  primaryEntity: string;
  defaultDateRange: string;
  isPublic: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ReportFormData {
  name: string;
  description: string;
  type: ReportType;
  primaryEntity: string;
}

const TYPE_ICONS: Record<ReportType, typeof BarChart3> = {
  campaign: BarChart3,
  agent: BarChart3,
  lead: TableIcon,
  call: TableIcon,
  disposition: TableIcon,
  custom: FileText,
};

const TYPE_LABELS: Record<ReportType, string> = {
  campaign: 'Campaign',
  agent: 'Agent',
  lead: 'Lead',
  call: 'Call',
  disposition: 'Disposition',
  custom: 'Custom',
};

export default function ReportsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<Report[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteReport, setDeleteReport] = useState<Report | null>(null);
  const [duplicateReport, setDuplicateReport] = useState<Report | null>(null);
  const [duplicateName, setDuplicateName] = useState('');

  const [formData, setFormData] = useState<ReportFormData>({
    name: '',
    description: '',
    type: 'call',
    primaryEntity: 'call',
  });
  const [formLoading, setFormLoading] = useState(false);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<Report[]>('/reports');
      setReports(data);
    } catch (err) {
      console.error('Failed to fetch reports:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleCreateReport = async () => {
    setFormLoading(true);
    try {
      const newReport = await apiFetch<Report>('/reports', {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          columns: getDefaultColumns(formData.primaryEntity),
          dateField: 'createdAt',
          defaultDateRange: 'last_7_days',
        }),
      });
      setCreateDialogOpen(false);
      resetForm();
      router.push(`/reports/${newReport.id}`);
    } catch (err) {
      console.error('Failed to create report:', err);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteReport = async () => {
    if (!deleteReport) return;
    try {
      await apiFetch(`/reports/${deleteReport.id}`, { method: 'DELETE' });
      setDeleteReport(null);
      fetchReports();
    } catch (err) {
      console.error('Failed to delete report:', err);
    }
  };

  const handleDuplicateReport = async () => {
    if (!duplicateReport || !duplicateName.trim()) return;
    try {
      const newReport = await apiFetch<Report>(`/reports/${duplicateReport.id}/duplicate`, {
        method: 'POST',
        body: JSON.stringify({ name: duplicateName }),
      });
      setDuplicateReport(null);
      setDuplicateName('');
      router.push(`/reports/${newReport.id}`);
    } catch (err) {
      console.error('Failed to duplicate report:', err);
    }
  };

  const handleRunReport = async (id: string) => {
    router.push(`/reports/${id}/run`);
  };

  const handleExportReport = async (id: string, format: 'csv' | 'excel' | 'json') => {
    try {
      const result = await apiFetch<{ downloadUrl: string }>(`/reports/${id}/export`, {
        method: 'POST',
        body: JSON.stringify({ format }),
      });
      window.open(result.downloadUrl, '_blank');
    } catch (err) {
      console.error('Failed to export report:', err);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      type: 'call',
      primaryEntity: 'call',
    });
  };

  const getDefaultColumns = (entity: string) => {
    const defaults: Record<string, Array<{ id: string; field: string; label: string; type: string; visible: boolean; sortable: boolean }>> = {
      call: [
        { id: 'created_at', field: 'createdAt', label: 'Date/Time', type: 'date', visible: true, sortable: true },
        { id: 'direction', field: 'direction', label: 'Direction', type: 'string', visible: true, sortable: true },
        { id: 'from', field: 'fromNumber', label: 'From', type: 'string', visible: true, sortable: false },
        { id: 'to', field: 'toNumber', label: 'To', type: 'string', visible: true, sortable: false },
        { id: 'status', field: 'status', label: 'Status', type: 'string', visible: true, sortable: true },
        { id: 'duration', field: 'duration', label: 'Duration', type: 'number', visible: true, sortable: true },
      ],
      lead: [
        { id: 'created_at', field: 'createdAt', label: 'Created', type: 'date', visible: true, sortable: true },
        { id: 'name', field: 'firstName', label: 'First Name', type: 'string', visible: true, sortable: true },
        { id: 'last_name', field: 'lastName', label: 'Last Name', type: 'string', visible: true, sortable: true },
        { id: 'phone', field: 'phoneNumber', label: 'Phone', type: 'string', visible: true, sortable: false },
        { id: 'status', field: 'status', label: 'Status', type: 'string', visible: true, sortable: true },
        { id: 'attempts', field: 'dialAttempts', label: 'Dial Attempts', type: 'number', visible: true, sortable: true },
      ],
      campaign: [
        { id: 'name', field: 'name', label: 'Campaign', type: 'string', visible: true, sortable: true },
        { id: 'status', field: 'status', label: 'Status', type: 'string', visible: true, sortable: true },
        { id: 'mode', field: 'dialingMode', label: 'Mode', type: 'string', visible: true, sortable: true },
        { id: 'created_at', field: 'createdAt', label: 'Created', type: 'date', visible: true, sortable: true },
      ],
    };
    return defaults[entity] || defaults.call;
  };

  const filteredReports = reports.filter(
    (report) =>
      report.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.description?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const systemReports = filteredReports.filter((r) => r.isSystem);
  const customReports = filteredReports.filter((r) => !r.isSystem);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Reports</h1>
          <p className="text-muted-foreground">
            Create, run, and schedule custom reports
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/reports/schedules')}>
            <Clock className="h-4 w-4 mr-2" />
            Schedules
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Report
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Input
            placeholder="Search reports..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button variant="outline" size="icon" onClick={fetchReports}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* System Reports */}
      {systemReports.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">System Reports</CardTitle>
            <CardDescription>Built-in reports for common use cases</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {systemReports.map((report) => {
                const Icon = TYPE_ICONS[report.type];
                return (
                  <Card
                    key={report.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => router.push(`/reports/${report.id}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{report.name}</div>
                          {report.description && (
                            <div className="text-sm text-muted-foreground line-clamp-2">
                              {report.description}
                            </div>
                          )}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleRunReport(report.id)}>
                              <Play className="h-4 w-4 mr-2" />
                              Run Report
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExportReport(report.id, 'csv')}>
                              <Download className="h-4 w-4 mr-2" />
                              Export CSV
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => {
                                setDuplicateReport(report);
                                setDuplicateName(`${report.name} (Copy)`);
                              }}
                            >
                              <Copy className="h-4 w-4 mr-2" />
                              Duplicate
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Custom Reports */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Custom Reports</CardTitle>
          <CardDescription>Your custom report definitions</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : customReports.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No Custom Reports</h3>
              <p className="text-muted-foreground mb-4">
                Create a custom report to analyze your data
              </p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Report
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date Range</TableHead>
                  <TableHead>Last Modified</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customReports.map((report) => (
                  <TableRow
                    key={report.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/reports/${report.id}`)}
                  >
                    <TableCell>
                      <div>
                        <div className="font-medium">{report.name}</div>
                        {report.description && (
                          <div className="text-sm text-muted-foreground truncate max-w-[300px]">
                            {report.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{TYPE_LABELS[report.type]}</Badge>
                    </TableCell>
                    <TableCell className="capitalize">
                      {report.defaultDateRange.replace(/_/g, ' ')}
                    </TableCell>
                    <TableCell>
                      {new Date(report.updatedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleRunReport(report.id)}>
                            <Play className="h-4 w-4 mr-2" />
                            Run Report
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => router.push(`/reports/${report.id}`)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleExportReport(report.id, 'csv')}>
                            <Download className="h-4 w-4 mr-2" />
                            Export CSV
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => {
                              setDuplicateReport(report);
                              setDuplicateName(`${report.name} (Copy)`);
                            }}
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteReport(report)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Report Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setCreateDialogOpen(false);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Report</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Report Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Daily Call Summary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>
            <div className="space-y-2">
              <Label>Report Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value: ReportType) => {
                  const entityMap: Record<ReportType, string> = {
                    campaign: 'campaign',
                    agent: 'call',
                    lead: 'lead',
                    call: 'call',
                    disposition: 'disposition',
                    custom: 'call',
                  };
                  setFormData({
                    ...formData,
                    type: value,
                    primaryEntity: entityMap[value],
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="call">Call Report</SelectItem>
                  <SelectItem value="lead">Lead Report</SelectItem>
                  <SelectItem value="campaign">Campaign Report</SelectItem>
                  <SelectItem value="agent">Agent Report</SelectItem>
                  <SelectItem value="disposition">Disposition Report</SelectItem>
                  <SelectItem value="custom">Custom Report</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setCreateDialogOpen(false);
              resetForm();
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateReport}
              disabled={formLoading || !formData.name.trim()}
            >
              {formLoading ? 'Creating...' : 'Create & Edit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteReport !== null} onOpenChange={(open) => !open && setDeleteReport(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Report</DialogTitle>
          </DialogHeader>
          <p>
            Are you sure you want to delete the report <strong>{deleteReport?.name}</strong>?
            This will also remove all schedules and execution history.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteReport(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteReport}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate Dialog */}
      <Dialog open={duplicateReport !== null} onOpenChange={(open) => {
        if (!open) {
          setDuplicateReport(null);
          setDuplicateName('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicate Report</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>New Report Name</Label>
            <Input
              value={duplicateName}
              onChange={(e) => setDuplicateName(e.target.value)}
              placeholder="Enter name for the duplicate"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setDuplicateReport(null);
              setDuplicateName('');
            }}>
              Cancel
            </Button>
            <Button onClick={handleDuplicateReport} disabled={!duplicateName.trim()}>
              Duplicate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
