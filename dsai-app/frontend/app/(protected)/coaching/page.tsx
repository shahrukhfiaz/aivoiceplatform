'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  GraduationCap,
  TrendingUp,
  TrendingDown,
  Target,
  Lightbulb,
  Users,
  RefreshCw,
  Search,
  BarChart3,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Eye,
  MessageSquare,
  Award,
  BookOpen,
  Check,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

// ==================== Types ====================

type EvaluationStatus = 'pending' | 'processing' | 'completed' | 'failed';
type InsightType = 'strength' | 'weakness' | 'trend' | 'recommendation' | 'alert';

interface CategoryScore {
  categoryId: string;
  categoryName: string;
  score: number;
  maxScore: number;
  reasoning?: string;
}

interface AiEvaluation {
  id: string;
  callId: string;
  agentId?: string;
  campaignId?: string;
  scorecardId?: string;
  categoryScores: CategoryScore[];
  totalScore: number;
  passed: boolean;
  overallSummary?: string;
  strengths?: string[];
  areasForImprovement?: string[];
  specificFeedback?: Array<{
    timestamp: number;
    utterance: string;
    feedback: string;
    severity: 'info' | 'warning' | 'critical';
  }>;
  llmProvider?: string;
  processingCost?: number;
  status: EvaluationStatus;
  createdAt: string;
}

interface CoachingInsight {
  id: string;
  agentId: string;
  campaignId?: string;
  insightType: InsightType;
  category?: string;
  title: string;
  description: string;
  severity: number;
  supportingData?: {
    callIds?: string[];
    avgScore?: number;
    trend?: 'improving' | 'declining' | 'stable';
    sampleCount?: number;
  };
  actionItems?: string[];
  isAcknowledged: boolean;
  acknowledgedAt?: string;
  managerNotes?: string;
  validUntil?: string;
  createdAt: string;
}

interface CoachingSummary {
  totalEvaluations: number;
  avgScore: number;
  passRate: number;
  activeInsights: number;
  evaluationsByStatus: Record<string, number>;
}

interface Agent {
  id: string;
  name: string;
}

interface Campaign {
  id: string;
  name: string;
}

// ==================== Component ====================

export default function CoachingPage() {
  const [loading, setLoading] = useState(true);
  const [evaluations, setEvaluations] = useState<AiEvaluation[]>([]);
  const [insights, setInsights] = useState<CoachingInsight[]>([]);
  const [summary, setSummary] = useState<CoachingSummary | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeTab, setActiveTab] = useState('evaluations');

  // Filters
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [selectedCampaign, setSelectedCampaign] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Dialog states
  const [viewEvaluation, setViewEvaluation] = useState<AiEvaluation | null>(null);
  const [viewInsight, setViewInsight] = useState<CoachingInsight | null>(null);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams();
      if (selectedAgent !== 'all') params.append('agentId', selectedAgent);
      if (selectedCampaign !== 'all') params.append('campaignId', selectedCampaign);

      const [evaluationsRes, insightsRes, agentsRes, campaignsRes] = await Promise.all([
        apiFetch<{ data: AiEvaluation[]; total: number }>(`/coaching/evaluations?${params.toString()}&limit=50`),
        apiFetch<CoachingInsight[]>(`/coaching/insights?${params.toString()}`),
        apiFetch<{ data: Agent[]; total: number }>('/agents'),
        apiFetch<{ data: Campaign[]; total: number }>('/campaigns'),
      ]);

      const evals = evaluationsRes?.data || [];
      setEvaluations(evals);
      setInsights(Array.isArray(insightsRes) ? insightsRes : []);
      setAgents(agentsRes?.data || []);
      setCampaigns(campaignsRes?.data || []);

      // Calculate summary
      const completed = evals.filter((e) => e.status === 'completed');
      const passed = completed.filter((e) => e.passed).length;
      const avgScore = completed.length > 0
        ? completed.reduce((sum, e) => sum + e.totalScore, 0) / completed.length
        : 0;
      const insightsArray = Array.isArray(insightsRes) ? insightsRes : [];
      const activeInsights = insightsArray.filter((i) => !i.isAcknowledged).length;

      const byStatus: Record<string, number> = {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
      };
      evals.forEach((e) => {
        byStatus[e.status] = (byStatus[e.status] || 0) + 1;
      });

      setSummary({
        totalEvaluations: evals.length,
        avgScore,
        passRate: completed.length > 0 ? (passed / completed.length) * 100 : 0,
        activeInsights,
        evaluationsByStatus: byStatus,
      });
    } catch (err) {
      console.error('Failed to fetch coaching data:', err);
      setSummary({
        totalEvaluations: 0,
        avgScore: 0,
        passRate: 0,
        activeInsights: 0,
        evaluationsByStatus: {
          pending: 0,
          processing: 0,
          completed: 0,
          failed: 0,
        },
      });
    } finally {
      setLoading(false);
    }
  }, [selectedAgent, selectedCampaign]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter evaluations by search term
  const filteredEvaluations = evaluations.filter((e) => {
    if (!searchTerm) return true;
    return e.callId.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Handlers
  const handleAcknowledgeInsight = async (insight: CoachingInsight) => {
    try {
      await apiFetch(`/coaching/insights/${insight.id}/acknowledge`, {
        method: 'POST',
      });
      fetchData();
      setViewInsight(null);
    } catch (err) {
      console.error('Failed to acknowledge insight:', err);
    }
  };

  // Render helpers
  const getScoreBadge = (score: number, passed: boolean) => {
    return passed ? (
      <Badge className="bg-green-500">
        <CheckCircle2 className="w-3 h-3 mr-1" />
        {score.toFixed(1)}%
      </Badge>
    ) : (
      <Badge className="bg-red-500">
        <XCircle className="w-3 h-3 mr-1" />
        {score.toFixed(1)}%
      </Badge>
    );
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusBadge = (status: EvaluationStatus) => {
    const styles: Record<EvaluationStatus, string> = {
      pending: 'bg-gray-500',
      processing: 'bg-blue-500',
      completed: 'bg-green-500',
      failed: 'bg-red-500',
    };
    return <Badge className={styles[status]}>{status}</Badge>;
  };

  const getInsightIcon = (type: InsightType) => {
    const icons: Record<InsightType, React.ReactNode> = {
      strength: <Award className="w-4 h-4 text-green-500" />,
      weakness: <AlertTriangle className="w-4 h-4 text-orange-500" />,
      trend: <TrendingUp className="w-4 h-4 text-blue-500" />,
      recommendation: <Lightbulb className="w-4 h-4 text-yellow-500" />,
      alert: <AlertTriangle className="w-4 h-4 text-red-500" />,
    };
    return icons[type];
  };

  const getInsightBadge = (type: InsightType) => {
    const styles: Record<InsightType, string> = {
      strength: 'bg-green-500',
      weakness: 'bg-orange-500',
      trend: 'bg-blue-500',
      recommendation: 'bg-yellow-500',
      alert: 'bg-red-500',
    };
    return (
      <Badge className={styles[type]}>
        {getInsightIcon(type)}
        <span className="ml-1 capitalize">{type}</span>
      </Badge>
    );
  };

  const getSeverityBadge = (severity: number) => {
    if (severity >= 8) return <Badge className="bg-red-500">Critical</Badge>;
    if (severity >= 5) return <Badge className="bg-orange-500">Warning</Badge>;
    return <Badge className="bg-blue-500">Info</Badge>;
  };

  const getTrendIcon = (trend?: 'improving' | 'declining' | 'stable') => {
    if (trend === 'improving') return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (trend === 'declining') return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <span className="text-gray-500">—</span>;
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
          <h1 className="text-3xl font-bold tracking-tight">AI Coaching</h1>
          <p className="text-muted-foreground">
            AI-powered call evaluations and agent coaching insights
          </p>
        </div>
        <Button onClick={fetchData} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <Select value={selectedAgent} onValueChange={setSelectedAgent}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Agents" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Agents</SelectItem>
            {agents.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

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

        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by Call ID..."
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
                <GraduationCap className="h-4 w-4" />
                AI Evaluations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalEvaluations}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {summary.evaluationsByStatus.completed} completed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Target className="h-4 w-4" />
                Average Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getScoreColor(summary.avgScore)}`}>
                {summary.avgScore.toFixed(1)}%
              </div>
              <Progress value={summary.avgScore} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Pass Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {summary.passRate.toFixed(1)}%
              </div>
              <Progress value={summary.passRate} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Lightbulb className="h-4 w-4" />
                Active Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500">{summary.activeInsights}</div>
              <p className="text-xs text-muted-foreground mt-1">Require attention</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="evaluations">
            <GraduationCap className="w-4 h-4 mr-2" />
            Evaluations
          </TabsTrigger>
          <TabsTrigger value="insights">
            <Lightbulb className="w-4 h-4 mr-2" />
            Insights ({insights.filter((i) => !i.isAcknowledged).length})
          </TabsTrigger>
        </TabsList>

        {/* Evaluations Tab */}
        <TabsContent value="evaluations" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>AI Call Evaluations</CardTitle>
              <CardDescription>
                Automated quality assessments of agent calls
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredEvaluations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <GraduationCap className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No AI evaluations yet</p>
                  <p className="text-sm">
                    Evaluations will appear here once calls are analyzed
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Call ID</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Categories</TableHead>
                      <TableHead>Strengths</TableHead>
                      <TableHead>Improvements</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEvaluations.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-mono text-sm">
                          {e.callId.slice(0, 8)}...
                        </TableCell>
                        <TableCell>{getScoreBadge(e.totalScore, e.passed)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {e.categoryScores.slice(0, 3).map((cs) => (
                              <Badge
                                key={cs.categoryId}
                                variant="outline"
                                className="text-xs"
                              >
                                {cs.categoryName}: {cs.score.toFixed(0)}%
                              </Badge>
                            ))}
                            {e.categoryScores.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{e.categoryScores.length - 3}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {e.strengths?.length ? (
                            <span className="text-green-600">{e.strengths.length} items</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {e.areasForImprovement?.length ? (
                            <span className="text-orange-600">{e.areasForImprovement.length} items</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(e.status)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(e.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setViewEvaluation(e)}
                          >
                            <Eye className="w-4 h-4" />
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

        {/* Insights Tab */}
        <TabsContent value="insights" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Coaching Insights</CardTitle>
              <CardDescription>
                AI-generated insights for agent improvement
              </CardDescription>
            </CardHeader>
            <CardContent>
              {insights.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Lightbulb className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No insights available</p>
                  <p className="text-sm">
                    Insights are generated based on evaluation patterns
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {insights.map((insight) => (
                    <Card
                      key={insight.id}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        insight.isAcknowledged ? 'opacity-60' : ''
                      }`}
                      onClick={() => setViewInsight(insight)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className="mt-1">{getInsightIcon(insight.insightType)}</div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium">{insight.title}</h4>
                                {getInsightBadge(insight.insightType)}
                                {getSeverityBadge(insight.severity)}
                                {insight.isAcknowledged && (
                                  <Badge variant="outline" className="text-xs">
                                    <Check className="w-3 h-3 mr-1" />
                                    Acknowledged
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {insight.description}
                              </p>
                              {insight.supportingData && (
                                <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                                  {insight.supportingData.avgScore !== undefined && (
                                    <span>Avg Score: {insight.supportingData.avgScore.toFixed(1)}%</span>
                                  )}
                                  {insight.supportingData.sampleCount !== undefined && (
                                    <span>Based on {insight.supportingData.sampleCount} calls</span>
                                  )}
                                  {insight.supportingData.trend && (
                                    <span className="flex items-center gap-1">
                                      Trend: {getTrendIcon(insight.supportingData.trend)}
                                      <span className="capitalize">{insight.supportingData.trend}</span>
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(insight.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* View Evaluation Dialog */}
      <Dialog open={!!viewEvaluation} onOpenChange={(open) => !open && setViewEvaluation(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>AI Evaluation Details</DialogTitle>
            <DialogDescription>
              Call ID: {viewEvaluation?.callId}
            </DialogDescription>
          </DialogHeader>

          {viewEvaluation && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Overall Score</Label>
                  <div className="text-2xl font-bold">
                    {viewEvaluation.totalScore.toFixed(1)}%
                  </div>
                  <Progress value={viewEvaluation.totalScore} className="mt-1" />
                </div>
                <div>
                  <Label className="text-muted-foreground">Result</Label>
                  <div className="mt-1">
                    {viewEvaluation.passed ? (
                      <Badge className="bg-green-500">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Pass
                      </Badge>
                    ) : (
                      <Badge className="bg-red-500">
                        <XCircle className="w-3 h-3 mr-1" />
                        Fail
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {viewEvaluation.overallSummary && (
                <div>
                  <Label className="text-muted-foreground">Summary</Label>
                  <p className="text-sm mt-1 p-2 bg-muted rounded">
                    {viewEvaluation.overallSummary}
                  </p>
                </div>
              )}

              <div>
                <Label className="text-muted-foreground">Category Scores</Label>
                <div className="space-y-2 mt-2">
                  {viewEvaluation.categoryScores.map((cs) => (
                    <div key={cs.categoryId} className="flex items-center gap-2">
                      <span className="w-32 text-sm">{cs.categoryName}</span>
                      <div className="flex-1">
                        <Progress value={(cs.score / cs.maxScore) * 100} />
                      </div>
                      <span className={`w-16 text-right text-sm ${getScoreColor((cs.score / cs.maxScore) * 100)}`}>
                        {cs.score}/{cs.maxScore}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {viewEvaluation.strengths && viewEvaluation.strengths.length > 0 && (
                <div>
                  <Label className="text-muted-foreground flex items-center gap-1">
                    <Award className="w-4 h-4 text-green-500" />
                    Strengths
                  </Label>
                  <ul className="list-disc list-inside text-sm mt-1 space-y-1">
                    {viewEvaluation.strengths.map((s, i) => (
                      <li key={i} className="text-green-700">{s}</li>
                    ))}
                  </ul>
                </div>
              )}

              {viewEvaluation.areasForImprovement && viewEvaluation.areasForImprovement.length > 0 && (
                <div>
                  <Label className="text-muted-foreground flex items-center gap-1">
                    <BookOpen className="w-4 h-4 text-orange-500" />
                    Areas for Improvement
                  </Label>
                  <ul className="list-disc list-inside text-sm mt-1 space-y-1">
                    {viewEvaluation.areasForImprovement.map((a, i) => (
                      <li key={i} className="text-orange-700">{a}</li>
                    ))}
                  </ul>
                </div>
              )}

              {viewEvaluation.specificFeedback && viewEvaluation.specificFeedback.length > 0 && (
                <div>
                  <Label className="text-muted-foreground flex items-center gap-1">
                    <MessageSquare className="w-4 h-4" />
                    Specific Feedback
                  </Label>
                  <div className="space-y-2 mt-2">
                    {viewEvaluation.specificFeedback.map((f, i) => (
                      <div
                        key={i}
                        className={`p-2 rounded text-sm ${
                          f.severity === 'critical'
                            ? 'bg-red-100 border-l-4 border-red-500'
                            : f.severity === 'warning'
                            ? 'bg-yellow-100 border-l-4 border-yellow-500'
                            : 'bg-blue-100 border-l-4 border-blue-500'
                        }`}
                      >
                        <p className="font-medium">&quot;{f.utterance}&quot;</p>
                        <p className="text-muted-foreground mt-1">{f.feedback}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setViewEvaluation(null)}>
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* View Insight Dialog */}
      <Dialog open={!!viewInsight} onOpenChange={(open) => !open && setViewInsight(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {viewInsight && getInsightIcon(viewInsight.insightType)}
              {viewInsight?.title}
            </DialogTitle>
          </DialogHeader>

          {viewInsight && (
            <div className="space-y-4">
              <div className="flex gap-2">
                {getInsightBadge(viewInsight.insightType)}
                {getSeverityBadge(viewInsight.severity)}
              </div>

              <p className="text-sm">{viewInsight.description}</p>

              {viewInsight.supportingData && (
                <div className="p-3 bg-muted rounded space-y-1">
                  {viewInsight.supportingData.avgScore !== undefined && (
                    <p className="text-sm">
                      Average Score: <span className="font-medium">{viewInsight.supportingData.avgScore.toFixed(1)}%</span>
                    </p>
                  )}
                  {viewInsight.supportingData.sampleCount !== undefined && (
                    <p className="text-sm">
                      Based on: <span className="font-medium">{viewInsight.supportingData.sampleCount} calls</span>
                    </p>
                  )}
                  {viewInsight.supportingData.trend && (
                    <p className="text-sm flex items-center gap-1">
                      Trend: {getTrendIcon(viewInsight.supportingData.trend)}
                      <span className="font-medium capitalize">{viewInsight.supportingData.trend}</span>
                    </p>
                  )}
                </div>
              )}

              {viewInsight.actionItems && viewInsight.actionItems.length > 0 && (
                <div>
                  <Label className="text-muted-foreground">Recommended Actions</Label>
                  <ul className="list-disc list-inside text-sm mt-1 space-y-1">
                    {viewInsight.actionItems.map((action, i) => (
                      <li key={i}>{action}</li>
                    ))}
                  </ul>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setViewInsight(null)}>
                  Close
                </Button>
                {!viewInsight.isAcknowledged && (
                  <Button onClick={() => handleAcknowledgeInsight(viewInsight)}>
                    <Check className="w-4 h-4 mr-2" />
                    Acknowledge
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
