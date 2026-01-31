'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Settings,
  Link2,
  RefreshCw,
  Save,
  Plus,
  Trash2,
  Activity,
  BarChart3,
  Check,
  X,
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

type CrmProvider = 'salesforce' | 'hubspot' | 'zoho' | 'custom';
type ConnectionStatus = 'active' | 'inactive' | 'error' | 'pending_auth';

interface CrmConnection {
  id: string;
  name: string;
  provider: CrmProvider;
  status: ConnectionStatus;
  syncDirection: 'to_crm' | 'from_crm' | 'bidirectional';
  autoSyncEnabled: boolean;
  syncIntervalMinutes: number;
  lastSyncAt?: string;
  lastSyncStatus?: string;
  totalSynced: number;
  syncErrors: number;
  entityMappings?: {
    lead?: { crmObject: string; enabled: boolean };
    call?: { crmObject: string; enabled: boolean };
    disposition?: { crmObject: string; enabled: boolean };
  };
  fieldMappings: FieldMapping[];
}

interface FieldMapping {
  id: string;
  entityType: string;
  localField: string;
  crmField: string;
  direction: 'to_crm' | 'from_crm' | 'bidirectional';
  transform: string;
  required: boolean;
  isActive: boolean;
}

interface SyncLog {
  id: string;
  entityType: string;
  operation: string;
  direction: string;
  status: string;
  recordsProcessed: number;
  recordsSuccess: number;
  recordsFailed: number;
  errorMessage?: string;
  durationMs?: number;
  createdAt: string;
}

interface CrmObject {
  name: string;
  label: string;
  fields: { name: string; label: string; type: string }[];
}

const LOCAL_FIELDS = {
  lead: [
    'id', 'firstName', 'lastName', 'phoneNumber', 'email', 'city', 'state', 'zipCode',
    'status', 'dialAttempts', 'lastDialedAt', 'createdAt',
  ],
  call: [
    'id', 'callId', 'direction', 'status', 'fromNumber', 'toNumber', 'duration',
    'createdAt', 'answeredAt', 'endedAt',
  ],
  disposition: [
    'id', 'code', 'name', 'category', 'notes',
  ],
};

export default function CrmConnectionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const connectionId = params.connectionId as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connection, setConnection] = useState<CrmConnection | null>(null);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [crmObjects, setCrmObjects] = useState<string[]>([]);
  const [objectMetadata, setObjectMetadata] = useState<Record<string, CrmObject>>({});

  // Mapping dialog
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [selectedEntityType, setSelectedEntityType] = useState('lead');
  const [newMapping, setNewMapping] = useState<{
    localField: string;
    crmField: string;
    direction: 'to_crm' | 'from_crm' | 'bidirectional';
    required: boolean;
  }>({
    localField: '',
    crmField: '',
    direction: 'to_crm',
    required: false,
  });

  const fetchConnection = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<CrmConnection>(`/crm/connections/${connectionId}`);
      setConnection(data);
    } catch (err) {
      console.error('Failed to fetch connection:', err);
    } finally {
      setLoading(false);
    }
  }, [connectionId]);

  const fetchSyncLogs = useCallback(async () => {
    try {
      const data = await apiFetch<SyncLog[]>(`/crm/connections/${connectionId}/sync-logs?limit=50`);
      setSyncLogs(data);
    } catch (err) {
      console.error('Failed to fetch sync logs:', err);
    }
  }, [connectionId]);

  const fetchCrmObjects = useCallback(async () => {
    try {
      const data = await apiFetch<{ objects: string[] }>(`/crm/connections/${connectionId}/objects`);
      setCrmObjects(data.objects);
    } catch (err) {
      console.error('Failed to fetch CRM objects:', err);
    }
  }, [connectionId]);

  useEffect(() => {
    fetchConnection();
    fetchSyncLogs();
  }, [fetchConnection, fetchSyncLogs]);

  useEffect(() => {
    if (connection?.status === 'active') {
      fetchCrmObjects();
    }
  }, [connection?.status, fetchCrmObjects]);

  const handleSaveSettings = async () => {
    if (!connection) return;
    setSaving(true);
    try {
      await apiFetch(`/crm/connections/${connectionId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          syncDirection: connection.syncDirection,
          autoSyncEnabled: connection.autoSyncEnabled,
          syncIntervalMinutes: connection.syncIntervalMinutes,
          entityMappings: connection.entityMappings,
        }),
      });
      fetchConnection();
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      const result = await apiFetch<{ success: boolean; message: string }>(
        `/crm/connections/${connectionId}/test`,
        { method: 'POST' },
      );
      alert(result.message);
      fetchConnection();
    } catch (err) {
      console.error('Failed to test connection:', err);
    }
  };

  const handleConnectOAuth = async () => {
    try {
      const redirectUri = `${window.location.origin}/crm/oauth-callback`;
      const result = await apiFetch<{ url: string }>(
        `/crm/connections/${connectionId}/auth-url?redirectUri=${encodeURIComponent(redirectUri)}`,
      );
      window.location.href = result.url;
    } catch (err) {
      console.error('Failed to get OAuth URL:', err);
    }
  };

  const handleAddMapping = async () => {
    try {
      await apiFetch('/crm/field-mappings', {
        method: 'POST',
        body: JSON.stringify({
          connectionId,
          entityType: selectedEntityType,
          ...newMapping,
        }),
      });
      setMappingDialogOpen(false);
      setNewMapping({ localField: '', crmField: '', direction: 'to_crm', required: false });
      fetchConnection();
    } catch (err) {
      console.error('Failed to add mapping:', err);
    }
  };

  const handleDeleteMapping = async (mappingId: string) => {
    if (!confirm('Delete this field mapping?')) return;
    try {
      await apiFetch(`/crm/field-mappings/${mappingId}`, { method: 'DELETE' });
      fetchConnection();
    } catch (err) {
      console.error('Failed to delete mapping:', err);
    }
  };

  const loadObjectMetadata = async (objectName: string) => {
    if (objectMetadata[objectName]) return;
    try {
      const data = await apiFetch<CrmObject>(
        `/crm/connections/${connectionId}/objects/${objectName}/metadata`,
      );
      setObjectMetadata((prev) => ({ ...prev, [objectName]: data }));
    } catch (err) {
      console.error('Failed to load object metadata:', err);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!connection) {
    return (
      <div className="text-center py-12">
        <p>Connection not found</p>
        <Button variant="link" onClick={() => router.push('/crm')}>
          Back to CRM
        </Button>
      </div>
    );
  }

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
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/crm')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">{connection.name}</h1>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>{connection.provider.charAt(0).toUpperCase() + connection.provider.slice(1)}</span>
            {getStatusBadge(connection.status)}
          </div>
        </div>
        {connection.status === 'pending_auth' && (
          <Button onClick={handleConnectOAuth}>
            <Link2 className="h-4 w-4 mr-2" />
            Connect OAuth
          </Button>
        )}
        <Button variant="outline" onClick={handleTestConnection}>
          <Activity className="h-4 w-4 mr-2" />
          Test Connection
        </Button>
      </div>

      <Tabs defaultValue="settings">
        <TabsList>
          <TabsTrigger value="settings">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="mappings">
            <Link2 className="h-4 w-4 mr-2" />
            Field Mappings
          </TabsTrigger>
          <TabsTrigger value="logs">
            <BarChart3 className="h-4 w-4 mr-2" />
            Sync Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Sync Settings</CardTitle>
              <CardDescription>Configure how data is synchronized with your CRM</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Sync Direction</Label>
                <Select
                  value={connection.syncDirection}
                  onValueChange={(value: 'to_crm' | 'from_crm' | 'bidirectional') =>
                    setConnection({ ...connection, syncDirection: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="to_crm">Push to CRM</SelectItem>
                    <SelectItem value="from_crm">Pull from CRM</SelectItem>
                    <SelectItem value="bidirectional">Bidirectional</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto Sync</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically sync data at regular intervals
                  </p>
                </div>
                <Switch
                  checked={connection.autoSyncEnabled}
                  onCheckedChange={(checked) =>
                    setConnection({ ...connection, autoSyncEnabled: checked })
                  }
                />
              </div>

              {connection.autoSyncEnabled && (
                <div className="space-y-2">
                  <Label>Sync Interval (minutes)</Label>
                  <Input
                    type="number"
                    min={5}
                    max={1440}
                    value={connection.syncIntervalMinutes}
                    onChange={(e) =>
                      setConnection({
                        ...connection,
                        syncIntervalMinutes: parseInt(e.target.value) || 60,
                      })
                    }
                  />
                </div>
              )}

              <div className="pt-4">
                <Button onClick={handleSaveSettings} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Settings'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Entity Mappings</CardTitle>
              <CardDescription>Map DSAI entities to CRM objects</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(['lead', 'call', 'disposition'] as const).map((entity) => (
                <div key={entity} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="font-medium capitalize">{entity}s</div>
                    <div className="text-sm text-muted-foreground">
                      Map to:{' '}
                      <Select
                        value={connection.entityMappings?.[entity]?.crmObject || ''}
                        onValueChange={(value) =>
                          setConnection({
                            ...connection,
                            entityMappings: {
                              ...connection.entityMappings,
                              [entity]: {
                                ...connection.entityMappings?.[entity],
                                crmObject: value,
                              },
                            },
                          })
                        }
                      >
                        <SelectTrigger className="w-40 inline-flex">
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          {crmObjects.map((obj) => (
                            <SelectItem key={obj} value={obj}>{obj}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Switch
                    checked={connection.entityMappings?.[entity]?.enabled ?? false}
                    onCheckedChange={(checked) =>
                      setConnection({
                        ...connection,
                        entityMappings: {
                          ...connection.entityMappings,
                          [entity]: {
                            ...connection.entityMappings?.[entity],
                            enabled: checked,
                            crmObject: connection.entityMappings?.[entity]?.crmObject || '',
                          },
                        },
                      })
                    }
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mappings" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Field Mappings</CardTitle>
                  <CardDescription>Map fields between DSAI and your CRM</CardDescription>
                </div>
                <Button onClick={() => setMappingDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Mapping
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {!connection.fieldMappings || connection.fieldMappings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No field mappings configured. Add mappings to sync data.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Entity</TableHead>
                      <TableHead>DSAI Field</TableHead>
                      <TableHead>CRM Field</TableHead>
                      <TableHead>Direction</TableHead>
                      <TableHead>Required</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {connection.fieldMappings.map((mapping) => (
                      <TableRow key={mapping.id}>
                        <TableCell className="capitalize">{mapping.entityType}</TableCell>
                        <TableCell>{mapping.localField}</TableCell>
                        <TableCell>{mapping.crmField}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {mapping.direction === 'to_crm' ? '→ CRM' :
                              mapping.direction === 'from_crm' ? '← CRM' : '↔'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {mapping.required ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <X className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteMapping(mapping.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Sync History</CardTitle>
                <Button variant="outline" size="icon" onClick={fetchSyncLogs}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {syncLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No sync history yet
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Operation</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">Records</TableHead>
                      <TableHead>Duration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {syncLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm">
                          {new Date(log.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="capitalize">{log.entityType}</TableCell>
                        <TableCell className="capitalize">{log.operation}</TableCell>
                        <TableCell>
                          <Badge variant={
                            log.status === 'completed' ? 'default' :
                              log.status === 'failed' ? 'destructive' :
                                log.status === 'partial' ? 'outline' : 'secondary'
                          }>
                            {log.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-green-600">{log.recordsSuccess}</span>
                          {log.recordsFailed > 0 && (
                            <span className="text-red-600"> / {log.recordsFailed}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {log.durationMs ? `${(log.durationMs / 1000).toFixed(1)}s` : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Mapping Dialog */}
      <Dialog open={mappingDialogOpen} onOpenChange={setMappingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Field Mapping</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Entity Type</Label>
              <Select
                value={selectedEntityType}
                onValueChange={(value) => {
                  setSelectedEntityType(value);
                  setNewMapping({ ...newMapping, localField: '', crmField: '' });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="call">Call</SelectItem>
                  <SelectItem value="disposition">Disposition</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>DSAI Field</Label>
              <Select
                value={newMapping.localField}
                onValueChange={(value) => setNewMapping({ ...newMapping, localField: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select field..." />
                </SelectTrigger>
                <SelectContent>
                  {LOCAL_FIELDS[selectedEntityType as keyof typeof LOCAL_FIELDS]?.map((field) => (
                    <SelectItem key={field} value={field}>{field}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>CRM Field</Label>
              <Input
                value={newMapping.crmField}
                onChange={(e) => setNewMapping({ ...newMapping, crmField: e.target.value })}
                placeholder="e.g., FirstName, Phone, etc."
              />
            </div>
            <div className="space-y-2">
              <Label>Direction</Label>
              <Select
                value={newMapping.direction}
                onValueChange={(value: 'to_crm' | 'from_crm' | 'bidirectional') =>
                  setNewMapping({ ...newMapping, direction: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="to_crm">Push to CRM</SelectItem>
                  <SelectItem value="from_crm">Pull from CRM</SelectItem>
                  <SelectItem value="bidirectional">Bidirectional</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>Required Field</Label>
              <Switch
                checked={newMapping.required}
                onCheckedChange={(checked) => setNewMapping({ ...newMapping, required: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMappingDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddMapping}
              disabled={!newMapping.localField || !newMapping.crmField}
            >
              Add Mapping
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
