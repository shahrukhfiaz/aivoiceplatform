'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Plus,
  MoreHorizontal,
  Flag,
  CircleCheck,
  Trash2,
  Search,
  RefreshCw,
  Upload,
  Phone,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
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
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface CallerIdPool {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  localPresenceEnabled: boolean;
  rotationStrategy: string;
  maxCallsPerNumber: number;
  cooldownMinutes: number;
}

interface CallerIdNumber {
  id: string;
  phoneNumber: string;
  areaCode: string;
  state?: string;
  city?: string;
  status: 'active' | 'cooling_down' | 'flagged' | 'blocked' | 'inactive';
  reputationLevel: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  reputationScore: number;
  callsToday: number;
  totalCalls: number;
  answeredCalls: number;
  flaggedCount: number;
  lastUsedAt?: string;
  cooldownUntil?: string;
}

interface PoolStats {
  totalNumbers: number;
  activeNumbers: number;
  coolingDownNumbers: number;
  flaggedNumbers: number;
  blockedNumbers: number;
  averageReputationScore: number;
  totalCallsToday: number;
  areaCodes: { areaCode: string; count: number }[];
}

export default function CallerIdPoolDetailPage() {
  const params = useParams();
  const router = useRouter();
  const poolId = params.poolId as string;

  const [loading, setLoading] = useState(true);
  const [pool, setPool] = useState<CallerIdPool | null>(null);
  const [numbers, setNumbers] = useState<CallerIdNumber[]>([]);
  const [stats, setStats] = useState<PoolStats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [flagDialogOpen, setFlagDialogOpen] = useState(false);
  const [selectedNumber, setSelectedNumber] = useState<CallerIdNumber | null>(null);

  const [addFormData, setAddFormData] = useState({ phoneNumber: '', state: '', city: '' });
  const [importData, setImportData] = useState('');
  const [flagReason, setFlagReason] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [poolData, numbersData, statsData] = await Promise.all([
        apiFetch<CallerIdPool>(`/caller-id/pools/${poolId}`),
        apiFetch<{ numbers: CallerIdNumber[]; total: number }>(`/caller-id/pools/${poolId}/numbers?limit=500`),
        apiFetch<PoolStats>(`/caller-id/pools/${poolId}/stats`),
      ]);
      setPool(poolData);
      setNumbers(numbersData.numbers);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to fetch pool data:', err);
    } finally {
      setLoading(false);
    }
  }, [poolId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddNumber = async () => {
    setFormLoading(true);
    try {
      await apiFetch(`/caller-id/pools/${poolId}/numbers`, {
        method: 'POST',
        body: JSON.stringify(addFormData),
      });
      setAddDialogOpen(false);
      setAddFormData({ phoneNumber: '', state: '', city: '' });
      fetchData();
    } catch (err) {
      console.error('Failed to add number:', err);
    } finally {
      setFormLoading(false);
    }
  };

  const handleImportNumbers = async () => {
    setFormLoading(true);
    try {
      const lines = importData.trim().split('\n').filter(Boolean);
      const numbers = lines.map(line => {
        const parts = line.split(',').map(p => p.trim());
        return { phoneNumber: parts[0], state: parts[1] || '', city: parts[2] || '' };
      });
      await apiFetch(`/caller-id/pools/${poolId}/numbers/import`, {
        method: 'POST',
        body: JSON.stringify({ numbers }),
      });
      setImportDialogOpen(false);
      setImportData('');
      fetchData();
    } catch (err) {
      console.error('Failed to import numbers:', err);
    } finally {
      setFormLoading(false);
    }
  };

  const handleFlagNumber = async () => {
    if (!selectedNumber) return;
    setFormLoading(true);
    try {
      await apiFetch(`/caller-id/numbers/${selectedNumber.id}/flag`, {
        method: 'POST',
        body: JSON.stringify({ reason: flagReason }),
      });
      setFlagDialogOpen(false);
      setSelectedNumber(null);
      setFlagReason('');
      fetchData();
    } catch (err) {
      console.error('Failed to flag number:', err);
    } finally {
      setFormLoading(false);
    }
  };

  const handleUnblockNumber = async (numberId: string) => {
    try {
      await apiFetch(`/caller-id/numbers/${numberId}/unblock`, { method: 'POST' });
      fetchData();
    } catch (err) {
      console.error('Failed to unblock number:', err);
    }
  };

  const handleDeleteNumber = async (numberId: string) => {
    try {
      await apiFetch(`/caller-id/numbers/${numberId}`, { method: 'DELETE' });
      fetchData();
    } catch (err) {
      console.error('Failed to delete number:', err);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
      active: 'default',
      cooling_down: 'outline',
      flagged: 'secondary',
      blocked: 'destructive',
      inactive: 'secondary',
    };
    return <Badge variant={variants[status] || 'secondary'}>{status.replace('_', ' ')}</Badge>;
  };

  const getReputationBadge = (level: string, score: number) => {
    const colors: Record<string, string> = {
      excellent: 'text-green-600',
      good: 'text-blue-600',
      fair: 'text-yellow-600',
      poor: 'text-orange-600',
      critical: 'text-red-600',
    };
    return (
      <div className="flex items-center gap-2">
        <Progress value={score} className="w-16 h-2" />
        <span className={`text-sm font-medium ${colors[level]}`}>{score}</span>
      </div>
    );
  };

  const filteredNumbers = numbers.filter(num => {
    const matchesSearch = num.phoneNumber.includes(searchQuery) ||
      num.areaCode.includes(searchQuery) ||
      (num.state?.toLowerCase().includes(searchQuery.toLowerCase()) || false);
    const matchesStatus = statusFilter === 'all' || num.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!pool) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Pool not found</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/caller-id')}>
          Back to Pools
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/caller-id')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">{pool.name}</h1>
          {pool.description && (
            <p className="text-muted-foreground">{pool.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Number
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Numbers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalNumbers}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.activeNumbers}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg Reputation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold">{stats.averageReputationScore}</div>
                {stats.averageReputationScore >= 70 ? (
                  <TrendingUp className="h-5 w-5 text-green-600" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-orange-600" />
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Calls Today</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalCallsToday}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Numbers Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search numbers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="cooling_down">Cooling Down</SelectItem>
                <SelectItem value="flagged">Flagged</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchData}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {filteredNumbers.length === 0 ? (
            <div className="text-center py-12">
              <Phone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No Numbers</h3>
              <p className="text-muted-foreground mb-4">
                Add phone numbers to this pool
              </p>
              <Button onClick={() => setAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Number
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Phone Number</TableHead>
                  <TableHead>Area Code</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reputation</TableHead>
                  <TableHead className="text-center">Calls Today</TableHead>
                  <TableHead className="text-center">Answer Rate</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredNumbers.map((num) => (
                  <TableRow key={num.id}>
                    <TableCell className="font-mono">{num.phoneNumber}</TableCell>
                    <TableCell>{num.areaCode}</TableCell>
                    <TableCell>
                      {num.city && num.state ? `${num.city}, ${num.state}` : num.state || '-'}
                    </TableCell>
                    <TableCell>{getStatusBadge(num.status)}</TableCell>
                    <TableCell>{getReputationBadge(num.reputationLevel, num.reputationScore)}</TableCell>
                    <TableCell className="text-center">{num.callsToday}</TableCell>
                    <TableCell className="text-center">
                      {num.totalCalls > 0
                        ? `${Math.round((num.answeredCalls / num.totalCalls) * 100)}%`
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {num.status === 'flagged' || num.status === 'blocked' ? (
                            <DropdownMenuItem onClick={() => handleUnblockNumber(num.id)}>
                              <CircleCheck className="h-4 w-4 mr-2" />
                              Unblock
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => {
                              setSelectedNumber(num);
                              setFlagDialogOpen(true);
                            }}>
                              <Flag className="h-4 w-4 mr-2" />
                              Flag as Spam
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDeleteNumber(num.id)}
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

      {/* Add Number Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Phone Number</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <Input
                id="phoneNumber"
                value={addFormData.phoneNumber}
                onChange={(e) => setAddFormData({ ...addFormData, phoneNumber: e.target.value })}
                placeholder="+1XXXXXXXXXX"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={addFormData.state}
                  onChange={(e) => setAddFormData({ ...addFormData, state: e.target.value })}
                  placeholder="CA"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={addFormData.city}
                  onChange={(e) => setAddFormData({ ...addFormData, city: e.target.value })}
                  placeholder="Los Angeles"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddNumber} disabled={formLoading || !addFormData.phoneNumber.trim()}>
              {formLoading ? 'Adding...' : 'Add Number'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Numbers</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter one number per line. Format: phone_number,state,city (state and city are optional)
            </p>
            <Textarea
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              placeholder={"+12135551234,CA,Los Angeles\n+14155551234,CA,San Francisco\n+12125551234,NY,New York"}
              rows={10}
              className="font-mono text-sm"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleImportNumbers} disabled={formLoading || !importData.trim()}>
              {formLoading ? 'Importing...' : 'Import'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Flag Number Dialog */}
      <Dialog open={flagDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setFlagDialogOpen(false);
          setSelectedNumber(null);
          setFlagReason('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Flag Number as Spam</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>
              Flagging <strong>{selectedNumber?.phoneNumber}</strong> will reduce its reputation and mark it as flagged.
            </p>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Input
                id="reason"
                value={flagReason}
                onChange={(e) => setFlagReason(e.target.value)}
                placeholder="e.g., Reported as spam by carrier"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setFlagDialogOpen(false);
              setSelectedNumber(null);
              setFlagReason('');
            }}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleFlagNumber} disabled={formLoading || !flagReason.trim()}>
              {formLoading ? 'Flagging...' : 'Flag Number'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
