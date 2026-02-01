'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Heart,
  TrendingUp,
  TrendingDown,
  Minus,
  Smile,
  Frown,
  Meh,
  AlertTriangle,
  RefreshCw,
  Search,
  BarChart3,
  Users,
  ThumbsUp,
  ThumbsDown,
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

// ==================== Types ====================

type SentimentLabel = 'very_negative' | 'negative' | 'neutral' | 'positive' | 'very_positive';
type Emotion = 'angry' | 'frustrated' | 'confused' | 'neutral' | 'satisfied' | 'happy' | 'excited';

interface CallSentiment {
  id: string;
  callId: string;
  campaignId?: string;
  agentId?: string;
  organizationId?: string;
  overallSentiment: number;
  overallLabel: SentimentLabel;
  customerStartSentiment: number;
  customerEndSentiment: number;
  customerSentimentDelta: number;
  emotionsDetected?: Array<{ emotion: Emotion; count: number; avgIntensity: number }>;
  dominantEmotion?: Emotion;
  customerSatisfied: boolean;
  satisfactionConfidence: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  llmProvider?: string;
  processingCost?: number;
  createdAt: string;
}

interface SentimentSummary {
  totalCalls: number;
  avgSentiment: number;
  sentimentDistribution: Record<SentimentLabel, number>;
  emotionDistribution: Record<Emotion, number>;
  satisfactionRate: number;
  avgSentimentDelta: number;
}

interface SentimentTrend {
  date: string;
  avgSentiment: number;
  satisfactionRate: number;
  count: number;
}

interface Campaign {
  id: string;
  name: string;
}

interface Agent {
  id: string;
  name: string;
}

// ==================== Component ====================

export default function SentimentPage() {
  const [loading, setLoading] = useState(true);
  const [sentiments, setSentiments] = useState<CallSentiment[]>([]);
  const [summary, setSummary] = useState<SentimentSummary | null>(null);
  const [trends, setTrends] = useState<SentimentTrend[]>([]);
  const [negativeCalls, setNegativeCalls] = useState<CallSentiment[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activeTab, setActiveTab] = useState('overview');

  // Filters
  const [selectedCampaign, setSelectedCampaign] = useState<string>('all');
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams();
      if (selectedCampaign !== 'all') params.append('campaignId', selectedCampaign);
      if (selectedAgent !== 'all') params.append('agentId', selectedAgent);

      const [sentimentsRes, summaryRes, trendsRes, alertsRes, campaignsRes, agentsRes] = await Promise.all([
        apiFetch<{ data: CallSentiment[]; total: number }>(`/sentiment/calls?${params.toString()}&limit=50`),
        apiFetch<SentimentSummary>(`/sentiment/summary?${params.toString()}`),
        apiFetch<SentimentTrend[]>(`/sentiment/trends?${params.toString()}&days=30`),
        apiFetch<CallSentiment[]>(`/sentiment/alerts/negative?${params.toString()}&limit=10`),
        apiFetch<{ data: Campaign[]; total: number }>('/campaigns'),
        apiFetch<{ data: Agent[]; total: number }>('/agents'),
      ]);

      setSentiments(sentimentsRes?.data || []);
      // Ensure all summary properties have default values
      setSummary({
        totalCalls: summaryRes?.totalCalls ?? 0,
        avgSentiment: summaryRes?.avgSentiment ?? 0,
        sentimentDistribution: summaryRes?.sentimentDistribution ?? {
          very_negative: 0,
          negative: 0,
          neutral: 0,
          positive: 0,
          very_positive: 0,
        },
        emotionDistribution: summaryRes?.emotionDistribution ?? {
          angry: 0,
          frustrated: 0,
          confused: 0,
          neutral: 0,
          satisfied: 0,
          happy: 0,
          excited: 0,
        },
        satisfactionRate: summaryRes?.satisfactionRate ?? 0,
        avgSentimentDelta: summaryRes?.avgSentimentDelta ?? 0,
      });
      setTrends(Array.isArray(trendsRes) ? trendsRes : []);
      setNegativeCalls(Array.isArray(alertsRes) ? alertsRes : []);
      setCampaigns(campaignsRes?.data || []);
      setAgents(agentsRes?.data || []);
    } catch (err) {
      console.error('Failed to fetch sentiment data:', err);
      // Set defaults on error
      setSummary({
        totalCalls: 0,
        avgSentiment: 0,
        sentimentDistribution: {
          very_negative: 0,
          negative: 0,
          neutral: 0,
          positive: 0,
          very_positive: 0,
        },
        emotionDistribution: {
          angry: 0,
          frustrated: 0,
          confused: 0,
          neutral: 0,
          satisfied: 0,
          happy: 0,
          excited: 0,
        },
        satisfactionRate: 0,
        avgSentimentDelta: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [selectedCampaign, selectedAgent]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter sentiments by search term
  const filteredSentiments = sentiments.filter((s) => {
    if (!searchTerm) return true;
    return s.callId.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Render helpers
  const getSentimentBadge = (label: SentimentLabel, score: number) => {
    const config: Record<SentimentLabel, { color: string; icon: React.ReactNode }> = {
      very_negative: { color: 'bg-red-600', icon: <Frown className="w-3 h-3 mr-1" /> },
      negative: { color: 'bg-red-400', icon: <Frown className="w-3 h-3 mr-1" /> },
      neutral: { color: 'bg-gray-500', icon: <Meh className="w-3 h-3 mr-1" /> },
      positive: { color: 'bg-green-400', icon: <Smile className="w-3 h-3 mr-1" /> },
      very_positive: { color: 'bg-green-600', icon: <Smile className="w-3 h-3 mr-1" /> },
    };
    const { color, icon } = config[label];
    return (
      <Badge className={`${color} flex items-center`}>
        {icon}
        {label.replace('_', ' ')} ({score.toFixed(2)})
      </Badge>
    );
  };

  const getDeltaBadge = (delta: number) => {
    if (delta > 0.1) {
      return (
        <Badge className="bg-green-500 flex items-center gap-1">
          <TrendingUp className="w-3 h-3" />
          +{(delta * 100).toFixed(0)}%
        </Badge>
      );
    }
    if (delta < -0.1) {
      return (
        <Badge className="bg-red-500 flex items-center gap-1">
          <TrendingDown className="w-3 h-3" />
          {(delta * 100).toFixed(0)}%
        </Badge>
      );
    }
    return (
      <Badge className="bg-gray-500 flex items-center gap-1">
        <Minus className="w-3 h-3" />
        Stable
      </Badge>
    );
  };

  const getEmotionIcon = (emotion: Emotion) => {
    const icons: Record<Emotion, React.ReactNode> = {
      angry: <Frown className="w-4 h-4 text-red-500" />,
      frustrated: <Frown className="w-4 h-4 text-orange-500" />,
      confused: <Meh className="w-4 h-4 text-yellow-500" />,
      neutral: <Meh className="w-4 h-4 text-gray-500" />,
      satisfied: <Smile className="w-4 h-4 text-green-400" />,
      happy: <Smile className="w-4 h-4 text-green-500" />,
      excited: <Smile className="w-4 h-4 text-green-600" />,
    };
    return icons[emotion];
  };

  const getSentimentColor = (score: number) => {
    if (score < -0.3) return 'text-red-600';
    if (score < 0) return 'text-orange-500';
    if (score < 0.3) return 'text-gray-600';
    return 'text-green-600';
  };

  // Calculate emotion distribution total for percentages
  const emotionTotal = summary
    ? Object.values(summary.emotionDistribution).reduce((a, b) => a + b, 0)
    : 0;

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
          <h1 className="text-3xl font-bold tracking-tight">Sentiment Analysis</h1>
          <p className="text-muted-foreground">
            Track customer emotions and satisfaction across calls
          </p>
        </div>
        <Button onClick={fetchData} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
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
                <BarChart3 className="h-4 w-4" />
                Calls Analyzed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalCalls}</div>
              <p className="text-xs text-muted-foreground mt-1">Total sentiment analyses</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Heart className="h-4 w-4" />
                Avg Sentiment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getSentimentColor(summary.avgSentiment)}`}>
                {summary.avgSentiment > 0 ? '+' : ''}{summary.avgSentiment.toFixed(2)}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 bg-gradient-to-r from-red-500 via-gray-400 to-green-500 rounded-full h-2 relative">
                  <div
                    className="absolute w-3 h-3 bg-white border-2 border-gray-800 rounded-full -top-0.5"
                    style={{ left: `${((summary.avgSentiment + 1) / 2) * 100}%`, transform: 'translateX(-50%)' }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <ThumbsUp className="h-4 w-4" />
                Satisfaction Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {summary.satisfactionRate.toFixed(1)}%
              </div>
              <Progress value={summary.satisfactionRate} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Avg Sentiment Delta
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span className={`text-2xl font-bold ${summary.avgSentimentDelta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {summary.avgSentimentDelta >= 0 ? '+' : ''}{summary.avgSentimentDelta.toFixed(2)}
                </span>
                {summary.avgSentimentDelta > 0 ? (
                  <TrendingUp className="w-5 h-5 text-green-500" />
                ) : summary.avgSentimentDelta < 0 ? (
                  <TrendingDown className="w-5 h-5 text-red-500" />
                ) : (
                  <Minus className="w-5 h-5 text-gray-500" />
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Start → End sentiment change</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sentiment & Emotion Distribution */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Sentiment Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Sentiment Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(summary.sentimentDistribution).map(([label, count]) => {
                  const total = Object.values(summary.sentimentDistribution).reduce((a, b) => a + b, 0);
                  const percentage = total > 0 ? (count / total) * 100 : 0;
                  const colors: Record<string, string> = {
                    very_negative: 'bg-red-600',
                    negative: 'bg-red-400',
                    neutral: 'bg-gray-500',
                    positive: 'bg-green-400',
                    very_positive: 'bg-green-600',
                  };
                  return (
                    <div key={label} className="flex items-center gap-2">
                      <span className="w-28 text-xs capitalize">{label.replace('_', ' ')}</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-4">
                        <div
                          className={`${colors[label]} h-4 rounded-full transition-all`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="w-16 text-xs text-right">{count} ({percentage.toFixed(0)}%)</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Emotion Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Emotion Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(summary.emotionDistribution)
                  .sort(([, a], [, b]) => b - a)
                  .map(([emotion, count]) => {
                    const percentage = emotionTotal > 0 ? (count / emotionTotal) * 100 : 0;
                    return (
                      <div key={emotion} className="flex items-center gap-2">
                        <span className="w-6">{getEmotionIcon(emotion as Emotion)}</span>
                        <span className="w-20 text-xs capitalize">{emotion}</span>
                        <div className="flex-1 bg-gray-200 rounded-full h-4">
                          <div
                            className="bg-blue-500 h-4 rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="w-16 text-xs text-right">{count} ({percentage.toFixed(0)}%)</span>
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">
            <Heart className="w-4 h-4 mr-2" />
            Recent Analyses
          </TabsTrigger>
          <TabsTrigger value="alerts">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Negative Alerts ({negativeCalls.length})
          </TabsTrigger>
        </TabsList>

        {/* Recent Analyses Tab */}
        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Sentiment Analyses</CardTitle>
              <CardDescription>
                View sentiment data for individual calls
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredSentiments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Heart className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No sentiment data yet</p>
                  <p className="text-sm">
                    Sentiment analyses will appear here once calls are processed
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Call ID</TableHead>
                      <TableHead>Sentiment</TableHead>
                      <TableHead>Delta</TableHead>
                      <TableHead>Dominant Emotion</TableHead>
                      <TableHead>Satisfied</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Analyzed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSentiments.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono text-sm">
                          {s.callId.slice(0, 8)}...
                        </TableCell>
                        <TableCell>
                          {getSentimentBadge(s.overallLabel, s.overallSentiment)}
                        </TableCell>
                        <TableCell>
                          {getDeltaBadge(s.customerSentimentDelta)}
                        </TableCell>
                        <TableCell>
                          {s.dominantEmotion && (
                            <div className="flex items-center gap-1">
                              {getEmotionIcon(s.dominantEmotion)}
                              <span className="text-sm capitalize">{s.dominantEmotion}</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {s.customerSatisfied ? (
                            <Badge className="bg-green-500">
                              <ThumbsUp className="w-3 h-3 mr-1" />
                              Yes
                            </Badge>
                          ) : (
                            <Badge className="bg-red-500">
                              <ThumbsDown className="w-3 h-3 mr-1" />
                              No
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              s.status === 'completed'
                                ? 'bg-green-500'
                                : s.status === 'processing'
                                ? 'bg-blue-500'
                                : s.status === 'failed'
                                ? 'bg-red-500'
                                : 'bg-gray-500'
                            }
                          >
                            {s.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(s.createdAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Negative Alerts Tab */}
        <TabsContent value="alerts" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
                Negative Sentiment Alerts
              </CardTitle>
              <CardDescription>
                Calls with significantly negative sentiment that may need attention
              </CardDescription>
            </CardHeader>
            <CardContent>
              {negativeCalls.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Smile className="w-12 h-12 mx-auto mb-4 opacity-50 text-green-500" />
                  <p>No negative sentiment alerts</p>
                  <p className="text-sm">All calls are showing positive or neutral sentiment</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Call ID</TableHead>
                      <TableHead>Sentiment Score</TableHead>
                      <TableHead>Label</TableHead>
                      <TableHead>Dominant Emotion</TableHead>
                      <TableHead>Delta</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {negativeCalls.map((s) => (
                      <TableRow key={s.id} className="bg-red-50 dark:bg-red-950/20">
                        <TableCell className="font-mono text-sm">
                          {s.callId.slice(0, 8)}...
                        </TableCell>
                        <TableCell>
                          <span className="text-red-600 font-bold">
                            {s.overallSentiment.toFixed(2)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {getSentimentBadge(s.overallLabel, s.overallSentiment)}
                        </TableCell>
                        <TableCell>
                          {s.dominantEmotion && (
                            <div className="flex items-center gap-1">
                              {getEmotionIcon(s.dominantEmotion)}
                              <span className="text-sm capitalize">{s.dominantEmotion}</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{getDeltaBadge(s.customerSentimentDelta)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(s.createdAt).toLocaleDateString()}
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
    </motion.div>
  );
}
