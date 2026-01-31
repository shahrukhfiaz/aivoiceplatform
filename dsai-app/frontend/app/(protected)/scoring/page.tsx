'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  Target,
  Clock,
  Users,
  RefreshCw,
  Search,
  BarChart3,
  Star,
  CheckCircle2,
  XCircle,
  Zap,
  Settings,
  Play,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

// ==================== Types ====================

interface LeadScore {
  id: string;
  leadId: string;
  campaignId?: string;
  overallScore: number;
  contactProbability: number;
  conversionProbability?: number;
  bestTimeSlots?: Array<{ dayOfWeek: number; hour: number; probability: number }>;
  preferredTimeZone?: string;
  features?: Record<string, number>;
  modelVersion?: string;
  scoredAt: string;
  expiresAt?: string;
  lead?: {
    id: string;
    firstName?: string;
    lastName?: string;
    phoneNumber: string;
    status: string;
    dialAttempts: number;
  };
}

interface ScoringModel {
  id: string;
  name: string;
  version: string;
  description?: string;
  featureWeights: Record<string, number>;
  isActive: boolean;
  isDefault: boolean;
  accuracy?: number;
  precision?: number;
  recall?: number;
  leadsScored: number;
  trainedAt?: string;
  createdAt: string;
}

interface ScoringSummary {
  totalScored: number;
  avgScore: number;
  highPriorityCount: number;
  expiredCount: number;
  scoreDistribution: Record<string, number>;
}

interface Campaign {
  id: string;
  name: string;
}

// ==================== Component ====================

export default function ScoringPage() {
  const [loading, setLoading] = useState(true);
  const [scores, setScores] = useState<LeadScore[]>([]);
  const [models, setModels] = useState<ScoringModel[]>([]);
  const [summary, setSummary] = useState<ScoringSummary | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeTab, setActiveTab] = useState('queue');

  // Filters
  const [selectedCampaign, setSelectedCampaign] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [minScore, setMinScore] = useState<number>(0);

  // Dialog states
  const [activateModel, setActivateModel] = useState<ScoringModel | null>(null);
  const [scoring, setScoring] = useState(false);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams();
      if (selectedCampaign !== 'all') params.append('campaignId', selectedCampaign);
      if (minScore > 0) params.append('minScore', minScore.toString());

      const [scoresRes, modelsRes, campaignsRes] = await Promise.all([
        apiFetch<{ data: LeadScore[]; total: number }>(`/scoring/leads?${params.toString()}&limit=50`),
        apiFetch<ScoringModel[]>('/scoring/models'),
        apiFetch<Campaign[]>('/campaigns'),
      ]);

      setScores(scoresRes.data || []);
      setModels(modelsRes || []);
      setCampaigns(campaignsRes || []);

      // Calculate summary from scores
      const allScores = scoresRes.data || [];
      const now = new Date();
      const highPriority = allScores.filter((s) => s.overallScore >= 70).length;
      const expired = allScores.filter((s) => s.expiresAt && new Date(s.expiresAt) < now).length;
      const avgScore = allScores.length > 0
        ? allScores.reduce((sum, s) => sum + s.overallScore, 0) / allScores.length
        : 0;

      // Score distribution buckets
      const distribution: Record<string, number> = {
        '0-20': 0,
        '21-40': 0,
        '41-60': 0,
        '61-80': 0,
        '81-100': 0,
      };
      allScores.forEach((s) => {
        if (s.overallScore <= 20) distribution['0-20']++;
        else if (s.overallScore <= 40) distribution['21-40']++;
        else if (s.overallScore <= 60) distribution['41-60']++;
        else if (s.overallScore <= 80) distribution['61-80']++;
        else distribution['81-100']++;
      });

      setSummary({
        totalScored: allScores.length,
        avgScore,
        highPriorityCount: highPriority,
        expiredCount: expired,
        scoreDistribution: distribution,
      });
    } catch (err) {
      console.error('Failed to fetch scoring data:', err);
      setSummary({
        totalScored: 0,
        avgScore: 0,
        highPriorityCount: 0,
        expiredCount: 0,
        scoreDistribution: {
          '0-20': 0,
          '21-40': 0,
          '41-60': 0,
          '61-80': 0,
          '81-100': 0,
        },
      });
    } finally {
      setLoading(false);
    }
  }, [selectedCampaign, minScore]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter scores by search term
  const filteredScores = scores.filter((s) => {
    if (!searchTerm) return true;
    const leadName = `${s.lead?.firstName || ''} ${s.lead?.lastName || ''}`.toLowerCase();
    const phone = s.lead?.phoneNumber || '';
    return leadName.includes(searchTerm.toLowerCase()) || phone.includes(searchTerm);
  });

  // Handlers
  const handleActivateModel = async () => {
    if (!activateModel) return;

    try {
      await apiFetch(`/scoring/models/${activateModel.id}/activate`, {
        method: 'POST',
      });
      setActivateModel(null);
      fetchData();
    } catch (err) {
      console.error('Failed to activate model:', err);
    }
  };

  const handleBatchScore = async () => {
    if (selectedCampaign === 'all') return;

    setScoring(true);
    try {
      await apiFetch('/scoring/batch', {
        method: 'POST',
        body: JSON.stringify({ campaignId: selectedCampaign }),
      });
      fetchData();
    } catch (err) {
      console.error('Failed to batch score:', err);
    } finally {
      setScoring(false);
    }
  };

  // Render helpers
  const getScoreBadge = (score: number) => {
    if (score >= 80) return <Badge className="bg-green-600">High ({score})</Badge>;
    if (score >= 60) return <Badge className="bg-green-400">Good ({score})</Badge>;
    if (score >= 40) return <Badge className="bg-yellow-500">Medium ({score})</Badge>;
    if (score >= 20) return <Badge className="bg-orange-500">Low ({score})</Badge>;
    return <Badge className="bg-red-500">Very Low ({score})</Badge>;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-green-500';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatBestTime = (slots?: LeadScore['bestTimeSlots']) => {
    if (!slots || slots.length === 0) return 'N/A';
    const best = slots[0];
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const hour = best.hour > 12 ? `${best.hour - 12}PM` : `${best.hour}AM`;
    return `${days[best.dayOfWeek]} ${hour}`;
  };

  const isExpired = (expiresAt?: string) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lead Scoring</h1>
          <p className="text-muted-foreground">
            Predictive scoring to prioritize leads for optimal contact rates
          </p>
        </div>
        <div className="flex gap-2">
          {selectedCampaign !== 'all' && (
            <Button onClick={handleBatchScore} disabled={scoring}>
              <Zap className="w-4 h-4 mr-2" />
              {scoring ? 'Scoring...' : 'Batch Score'}
            </Button>
          )}
          <Button onClick={fetchData} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Campaigns" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Campaigns</SelectItem>
            {campaigns.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={minScore.toString()}
          onValueChange={(v) => setMinScore(parseInt(v))}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Min Score" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">All Scores</SelectItem>
            <SelectItem value="40">40+</SelectItem>
            <SelectItem value="60">60+</SelectItem>
            <SelectItem value="80">80+</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Stats Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Target className="h-4 w-4" />
                Leads Scored
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalScored}</div>
              <p className="text-xs text-muted-foreground mt-1">Total scored leads</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Average Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getScoreColor(summary.avgScore)}`}>
                {summary.avgScore.toFixed(1)}
              </div>
              <Progress value={summary.avgScore} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Star className="h-4 w-4" />
                High Priority
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{summary.highPriorityCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Score 70+</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Expired Scores
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500">{summary.expiredCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Need re-scoring</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Score Distribution */}
      {summary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Score Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 h-32">
              {Object.entries(summary.scoreDistribution).map(([bucket, count]) => {
                const maxCount = Math.max(...Object.values(summary.scoreDistribution), 1);
                const height = (count / maxCount) * 100;
                const colors: Record<string, string> = {
                  '0-20': 'bg-red-500',
                  '21-40': 'bg-orange-500',
                  '41-60': 'bg-yellow-500',
                  '61-80': 'bg-green-400',
                  '81-100': 'bg-green-600',
                };
                return (
                  <div key={bucket} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex flex-col items-center justify-end h-24">
                      <span className="text-xs font-medium mb-1">{count}</span>
                      <div
                        className={`w-full rounded-t ${colors[bucket]} transition-all`}
                        style={{ height: `${height}%`, minHeight: count > 0 ? '4px' : '0' }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">{bucket}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="queue">
            <Users className="w-4 h-4 mr-2" />
            Priority Queue
          </TabsTrigger>
          <TabsTrigger value="models">
            <Settings className="w-4 h-4 mr-2" />
            Scoring Models
          </TabsTrigger>
        </TabsList>

        {/* Priority Queue Tab */}
        <TabsContent value="queue" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Priority Queue</CardTitle>
              <CardDescription>
                Leads sorted by score for optimal dialing order
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredScores.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No scored leads yet</p>
                  <p className="text-sm">
                    Run batch scoring to generate lead priorities
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lead</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Contact Prob.</TableHead>
                      <TableHead>Best Time</TableHead>
                      <TableHead>Attempts</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Expires</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredScores.map((s) => (
                      <TableRow key={s.id} className={isExpired(s.expiresAt) ? 'opacity-50' : ''}>
                        <TableCell className="font-medium">
                          {s.lead?.firstName} {s.lead?.lastName}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {s.lead?.phoneNumber}
                        </TableCell>
                        <TableCell>{getScoreBadge(s.overallScore)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{(s.contactProbability * 100).toFixed(0)}%</span>
                            <Progress value={s.contactProbability * 100} className="w-12 h-2" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            <Clock className="w-3 h-3 mr-1" />
                            {formatBestTime(s.bestTimeSlots)}
                          </Badge>
                        </TableCell>
                        <TableCell>{s.lead?.dialAttempts || 0}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {s.lead?.status || 'N/A'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {isExpired(s.expiresAt) ? (
                            <Badge className="bg-orange-500">Expired</Badge>
                          ) : s.expiresAt ? (
                            <span className="text-xs text-muted-foreground">
                              {new Date(s.expiresAt).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Never</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scoring Models Tab */}
        <TabsContent value="models" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Scoring Models</CardTitle>
              <CardDescription>
                Machine learning models used for lead scoring
              </CardDescription>
            </CardHeader>
            <CardContent>
              {models.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No scoring models configured</p>
                  <p className="text-sm">Models will be created during initial setup</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Model</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Leads Scored</TableHead>
                      <TableHead>Accuracy</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Trained</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {models.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{m.name}</span>
                            {m.isDefault && (
                              <Badge variant="outline" className="text-xs">Default</Badge>
                            )}
                          </div>
                          {m.description && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {m.description}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{m.version}</TableCell>
                        <TableCell>{m.leadsScored.toLocaleString()}</TableCell>
                        <TableCell>
                          {m.accuracy ? (
                            <div className="flex items-center gap-2">
                              <span className={getScoreColor(m.accuracy * 100)}>
                                {(m.accuracy * 100).toFixed(1)}%
                              </span>
                              <Progress value={m.accuracy * 100} className="w-12 h-2" />
                            </div>
                          ) : (
                            <span className="text-muted-foreground">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {m.isActive ? (
                            <Badge className="bg-green-500">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <XCircle className="w-3 h-3 mr-1" />
                              Inactive
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {m.trainedAt
                            ? new Date(m.trainedAt).toLocaleDateString()
                            : 'Not trained'}
                        </TableCell>
                        <TableCell>
                          {!m.isActive && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setActivateModel(m)}
                            >
                              <Play className="w-4 h-4 mr-1" />
                              Activate
                            </Button>
                          )}
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

      {/* Activate Model Confirmation */}
      <AlertDialog open={!!activateModel} onOpenChange={(open) => !open && setActivateModel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Activate Scoring Model</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to activate &quot;{activateModel?.name}&quot;?
              This will deactivate the current active model and use this one for all future scoring.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleActivateModel}>
              Activate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
