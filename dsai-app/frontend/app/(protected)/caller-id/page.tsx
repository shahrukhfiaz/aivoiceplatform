'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  PhoneForwarded,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Play,
  Pause,
  BarChart3,
  Search,
  RefreshCw,
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
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useRouter } from 'next/navigation';

interface CallerIdPool {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  localPresenceEnabled: boolean;
  rotationStrategy: 'round_robin' | 'random' | 'weighted' | 'least_recently_used';
  maxCallsPerNumber: number;
  cooldownMinutes: number;
  totalNumbers?: number;
  activeNumbers?: number;
  flaggedNumbers?: number;
  createdAt: string;
  updatedAt: string;
}

interface PoolFormData {
  name: string;
  description: string;
  isActive: boolean;
  localPresenceEnabled: boolean;
  rotationStrategy: string;
  maxCallsPerNumber: number;
  cooldownMinutes: number;
}

export default function CallerIdPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [pools, setPools] = useState<CallerIdPool[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editPool, setEditPool] = useState<CallerIdPool | null>(null);
  const [deletePool, setDeletePool] = useState<CallerIdPool | null>(null);

  const [formData, setFormData] = useState<PoolFormData>({
    name: '',
    description: '',
    isActive: true,
    localPresenceEnabled: true,
    rotationStrategy: 'round_robin',
    maxCallsPerNumber: 50,
    cooldownMinutes: 60,
  });
  const [formLoading, setFormLoading] = useState(false);

  const fetchPools = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<CallerIdPool[]>('/caller-id/pools');
      setPools(data);
    } catch (err) {
      console.error('Failed to fetch caller ID pools:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPools();
  }, [fetchPools]);

  const handleCreatePool = async () => {
    setFormLoading(true);
    try {
      await apiFetch('/caller-id/pools', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      setCreateDialogOpen(false);
      resetForm();
      fetchPools();
    } catch (err) {
      console.error('Failed to create pool:', err);
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdatePool = async () => {
    if (!editPool) return;
    setFormLoading(true);
    try {
      await apiFetch(`/caller-id/pools/${editPool.id}`, {
        method: 'PATCH',
        body: JSON.stringify(formData),
      });
      setEditPool(null);
      resetForm();
      fetchPools();
    } catch (err) {
      console.error('Failed to update pool:', err);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeletePool = async () => {
    if (!deletePool) return;
    try {
      await apiFetch(`/caller-id/pools/${deletePool.id}`, { method: 'DELETE' });
      setDeletePool(null);
      fetchPools();
    } catch (err) {
      console.error('Failed to delete pool:', err);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      isActive: true,
      localPresenceEnabled: true,
      rotationStrategy: 'round_robin',
      maxCallsPerNumber: 50,
      cooldownMinutes: 60,
    });
  };

  const openEditDialog = (pool: CallerIdPool) => {
    setFormData({
      name: pool.name,
      description: pool.description || '',
      isActive: pool.isActive,
      localPresenceEnabled: pool.localPresenceEnabled,
      rotationStrategy: pool.rotationStrategy,
      maxCallsPerNumber: pool.maxCallsPerNumber,
      cooldownMinutes: pool.cooldownMinutes,
    });
    setEditPool(pool);
  };

  const filteredPools = pools.filter(pool =>
    pool.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRotationLabel = (strategy: string) => {
    const labels: Record<string, string> = {
      round_robin: 'Round Robin',
      random: 'Random',
      weighted: 'Weighted (by reputation)',
      least_recently_used: 'Least Recently Used',
    };
    return labels[strategy] || strategy;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Caller ID Pools</h1>
          <p className="text-muted-foreground">
            Manage caller ID pools for local presence dialing
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Pool
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search pools..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" size="icon" onClick={fetchPools}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredPools.length === 0 ? (
            <div className="text-center py-12">
              <PhoneForwarded className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No Caller ID Pools</h3>
              <p className="text-muted-foreground mb-4">
                Create a pool to manage caller IDs for local presence dialing
              </p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Pool
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Local Presence</TableHead>
                  <TableHead>Rotation</TableHead>
                  <TableHead className="text-center">Numbers</TableHead>
                  <TableHead className="text-center">Active</TableHead>
                  <TableHead className="text-center">Flagged</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPools.map((pool) => (
                  <TableRow
                    key={pool.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/caller-id/${pool.id}`)}
                  >
                    <TableCell>
                      <div>
                        <div className="font-medium">{pool.name}</div>
                        {pool.description && (
                          <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                            {pool.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={pool.isActive ? 'default' : 'secondary'}>
                        {pool.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={pool.localPresenceEnabled ? 'outline' : 'secondary'}>
                        {pool.localPresenceEnabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </TableCell>
                    <TableCell>{getRotationLabel(pool.rotationStrategy)}</TableCell>
                    <TableCell className="text-center">{pool.totalNumbers || 0}</TableCell>
                    <TableCell className="text-center">
                      <span className="text-green-600">{pool.activeNumbers || 0}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-orange-600">{pool.flaggedNumbers || 0}</span>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/caller-id/${pool.id}`)}>
                            <BarChart3 className="h-4 w-4 mr-2" />
                            View Numbers
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditDialog(pool)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeletePool(pool)}
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

      {/* Create/Edit Dialog */}
      <Dialog
        open={createDialogOpen || editPool !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreateDialogOpen(false);
            setEditPool(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editPool ? 'Edit Caller ID Pool' : 'Create Caller ID Pool'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Pool Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., US West Coast Numbers"
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
            <div className="flex items-center justify-between">
              <Label htmlFor="isActive">Active</Label>
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="localPresence">Local Presence (Area Code Matching)</Label>
              <Switch
                id="localPresence"
                checked={formData.localPresenceEnabled}
                onCheckedChange={(checked) => setFormData({ ...formData, localPresenceEnabled: checked })}
              />
            </div>
            <div className="space-y-2">
              <Label>Rotation Strategy</Label>
              <Select
                value={formData.rotationStrategy}
                onValueChange={(value) => setFormData({ ...formData, rotationStrategy: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="round_robin">Round Robin</SelectItem>
                  <SelectItem value="random">Random</SelectItem>
                  <SelectItem value="weighted">Weighted (by reputation)</SelectItem>
                  <SelectItem value="least_recently_used">Least Recently Used</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maxCalls">Max Calls/Number/Day</Label>
                <Input
                  id="maxCalls"
                  type="number"
                  value={formData.maxCallsPerNumber}
                  onChange={(e) => setFormData({ ...formData, maxCallsPerNumber: parseInt(e.target.value) || 50 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cooldown">Cooldown (minutes)</Label>
                <Input
                  id="cooldown"
                  type="number"
                  value={formData.cooldownMinutes}
                  onChange={(e) => setFormData({ ...formData, cooldownMinutes: parseInt(e.target.value) || 60 })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setCreateDialogOpen(false);
              setEditPool(null);
              resetForm();
            }}>
              Cancel
            </Button>
            <Button
              onClick={editPool ? handleUpdatePool : handleCreatePool}
              disabled={formLoading || !formData.name.trim()}
            >
              {formLoading ? 'Saving...' : editPool ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deletePool !== null} onOpenChange={(open) => !open && setDeletePool(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Caller ID Pool</DialogTitle>
          </DialogHeader>
          <p>
            Are you sure you want to delete the pool <strong>{deletePool?.name}</strong>?
            This will also remove all numbers in this pool.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletePool(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeletePool}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
