'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Database,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Check,
  X,
  RefreshCw,
  Link2,
  Link2Off,
  Settings,
  Activity,
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

type CrmProvider = 'salesforce' | 'hubspot' | 'zoho' | 'custom';
type ConnectionStatus = 'active' | 'inactive' | 'error' | 'pending_auth';

interface CrmConnection {
  id: string;
  name: string;
  provider: CrmProvider;
  status: ConnectionStatus;
  autoSyncEnabled: boolean;
  syncIntervalMinutes: number;
  lastSyncAt?: string;
  lastSyncStatus?: string;
  totalSynced: number;
  syncErrors: number;
  createdAt: string;
}

interface ConnectionFormData {
  name: string;
  provider: CrmProvider;
  apiKey: string;
  settings: {
    instanceUrl?: string;
    sandbox?: boolean;
  };
}

const PROVIDER_LABELS: Record<CrmProvider, string> = {
  salesforce: 'Salesforce',
  hubspot: 'HubSpot',
  zoho: 'Zoho CRM',
  custom: 'Custom CRM',
};

const PROVIDER_ICONS: Record<CrmProvider, string> = {
  salesforce: '☁️',
  hubspot: '🟠',
  zoho: '🔷',
  custom: '⚙️',
};

export default function CrmPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [connections, setConnections] = useState<CrmConnection[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteConnection, setDeleteConnection] = useState<CrmConnection | null>(null);
  const [testingConnection, setTestingConnection] = useState<string | null>(null);

  const [formData, setFormData] = useState<ConnectionFormData>({
    name: '',
    provider: 'salesforce',
    apiKey: '',
    settings: {},
  });
  const [formLoading, setFormLoading] = useState(false);

  const fetchConnections = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<CrmConnection[]>('/crm/connections');
      setConnections(data);
    } catch (err) {
      console.error('Failed to fetch CRM connections:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const handleCreateConnection = async () => {
    setFormLoading(true);
    try {
      await apiFetch('/crm/connections', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      setCreateDialogOpen(false);
      resetForm();
      fetchConnections();
    } catch (err) {
      console.error('Failed to create connection:', err);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteConnection = async () => {
    if (!deleteConnection) return;
    try {
      await apiFetch(`/crm/connections/${deleteConnection.id}`, { method: 'DELETE' });
      setDeleteConnection(null);
      fetchConnections();
    } catch (err) {
      console.error('Failed to delete connection:', err);
    }
  };

  const handleTestConnection = async (id: string) => {
    setTestingConnection(id);
    try {
      const result = await apiFetch<{ success: boolean; message: string }>(
        `/crm/connections/${id}/test`,
        { method: 'POST' },
      );
      alert(result.message);
      fetchConnections();
    } catch (err) {
      console.error('Failed to test connection:', err);
    } finally {
      setTestingConnection(null);
    }
  };

  const handleConnectOAuth = async (id: string) => {
    try {
      const redirectUri = `${window.location.origin}/crm/oauth-callback`;
      const result = await apiFetch<{ url: string }>(
        `/crm/connections/${id}/auth-url?redirectUri=${encodeURIComponent(redirectUri)}`,
      );
      window.location.href = result.url;
    } catch (err) {
      console.error('Failed to get OAuth URL:', err);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      provider: 'salesforce',
      apiKey: '',
      settings: {},
    });
  };

  const getStatusBadge = (status: ConnectionStatus) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-500">Active</Badge>;
      case 'inactive':
        return <Badge variant="secondary">Inactive</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'pending_auth':
        return <Badge variant="outline" className="border-orange-500 text-orange-500">Pending Auth</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">CRM Integrations</h1>
          <p className="text-muted-foreground">
            Connect your CRM systems for automatic data sync
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Connection
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Connections
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{connections.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {connections.filter((c) => c.status === 'active').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Records Synced
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {connections.reduce((sum, c) => sum + c.totalSynced, 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Sync Errors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {connections.reduce((sum, c) => sum + c.syncErrors, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>CRM Connections</CardTitle>
            <Button variant="outline" size="icon" onClick={fetchConnections}>
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
          ) : connections.length === 0 ? (
            <div className="text-center py-12">
              <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No CRM Connections</h3>
              <p className="text-muted-foreground mb-4">
                Connect a CRM to sync leads, calls, and dispositions
              </p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Connection
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Auto Sync</TableHead>
                  <TableHead className="text-center">Synced</TableHead>
                  <TableHead>Last Sync</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {connections.map((connection) => (
                  <TableRow
                    key={connection.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/crm/${connection.id}`)}
                  >
                    <TableCell>
                      <div className="font-medium">{connection.name}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{PROVIDER_ICONS[connection.provider]}</span>
                        <span>{PROVIDER_LABELS[connection.provider]}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(connection.status)}</TableCell>
                    <TableCell>
                      {connection.autoSyncEnabled ? (
                        <Badge variant="outline" className="text-green-600">
                          Every {connection.syncIntervalMinutes}m
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Off</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {connection.totalSynced.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {connection.lastSyncAt ? (
                        <div className="flex items-center gap-1">
                          {connection.lastSyncStatus === 'success' ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <X className="h-3 w-3 text-red-500" />
                          )}
                          <span className="text-sm text-muted-foreground">
                            {new Date(connection.lastSyncAt).toLocaleDateString()}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Never</span>
                      )}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/crm/${connection.id}`)}>
                            <Settings className="h-4 w-4 mr-2" />
                            Settings
                          </DropdownMenuItem>
                          {connection.status === 'pending_auth' && (
                            <DropdownMenuItem onClick={() => handleConnectOAuth(connection.id)}>
                              <Link2 className="h-4 w-4 mr-2" />
                              Connect OAuth
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => handleTestConnection(connection.id)}
                            disabled={testingConnection === connection.id}
                          >
                            <Activity className="h-4 w-4 mr-2" />
                            {testingConnection === connection.id ? 'Testing...' : 'Test Connection'}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteConnection(connection)}
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

      {/* Create Connection Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setCreateDialogOpen(false);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add CRM Connection</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Connection Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Production Salesforce"
              />
            </div>
            <div className="space-y-2">
              <Label>CRM Provider</Label>
              <Select
                value={formData.provider}
                onValueChange={(value: CrmProvider) => setFormData({ ...formData, provider: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="salesforce">☁️ Salesforce</SelectItem>
                  <SelectItem value="hubspot">🟠 HubSpot</SelectItem>
                  <SelectItem value="zoho">🔷 Zoho CRM</SelectItem>
                  <SelectItem value="custom">⚙️ Custom CRM</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formData.provider === 'salesforce' && (
              <>
                <div className="flex items-center justify-between">
                  <Label htmlFor="sandbox">Sandbox Environment</Label>
                  <Switch
                    id="sandbox"
                    checked={formData.settings.sandbox || false}
                    onCheckedChange={(checked) =>
                      setFormData({
                        ...formData,
                        settings: { ...formData.settings, sandbox: checked },
                      })
                    }
                  />
                </div>
              </>
            )}
            {formData.provider === 'hubspot' && (
              <div className="space-y-2">
                <Label htmlFor="apiKey">API Key (Optional)</Label>
                <Input
                  id="apiKey"
                  type="password"
                  value={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  placeholder="Use OAuth for production"
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty to use OAuth authentication (recommended)
                </p>
              </div>
            )}
            {formData.provider === 'custom' && (
              <div className="space-y-2">
                <Label htmlFor="instanceUrl">API Base URL</Label>
                <Input
                  id="instanceUrl"
                  value={formData.settings.instanceUrl || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      settings: { ...formData.settings, instanceUrl: e.target.value },
                    })
                  }
                  placeholder="https://api.your-crm.com"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setCreateDialogOpen(false);
              resetForm();
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateConnection}
              disabled={formLoading || !formData.name.trim()}
            >
              {formLoading ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConnection !== null} onOpenChange={(open) => !open && setDeleteConnection(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete CRM Connection</DialogTitle>
          </DialogHeader>
          <p>
            Are you sure you want to delete the connection <strong>{deleteConnection?.name}</strong>?
            This will also remove all field mappings and sync history.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConnection(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConnection}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
