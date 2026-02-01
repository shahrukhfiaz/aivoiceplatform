'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3,
  Mic,
  MessageSquare,
  FileText,
  Clock,
  Volume2,
  VolumeX,
  Users,
  RefreshCw,
  Search,
  Filter,
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

interface CallAnalytics {
  id: string;
  callId: string;
  campaignId?: string;
  agentId?: string;
  talkRatio: number;
  listenRatio: number;
  agentTalkTimeSeconds: number;
  customerTalkTimeSeconds: number;
  totalSilenceSeconds: number;
  silenceCount: number;
  avgSilenceDuration: number;
  longestSilenceSeconds: number;
  agentWordsPerMinute: number;
  customerWordsPerMinute: number;
  scriptAdherenceScore: number;
  missedScriptElements?: string[];
  agentInterruptions: number;
  customerInterruptions: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  processingCost?: number;
  analyzedAt: string;
  createdAt: string;
}

interface KeywordMatch {
  id: string;
  callAnalyticsId: string;
  keyword: string;
  category: 'compliance' | 'objection' | 'positive' | 'negative' | 'competitor';
  speaker: 'agent' | 'customer';
  matchedText: string;
  timestampMs?: number;
  confidence: number;
}

interface AnalyticsSummary {
  totalCalls: number;
  avgTalkRatio: number;
  avgScriptAdherence: number;
  avgSilenceSeconds: number;
  totalKeywordMatches: number;
  avgAgentWpm: number;
  avgCustomerWpm: number;
  avgInterruptions: number;
}

interface KeywordConfig {
  id: string;
  keyword: string;
  category: string;
  isActive: boolean;
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

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<CallAnalytics[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [keywords, setKeywords] = useState<KeywordConfig[]>([]);
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

      const [analyticsRes, summaryRes, keywordsRes, campaignsRes, agentsRes] = await Promise.all([
        apiFetch<{ data: CallAnalytics[]; total: number }>(`/analytics/calls?${params.toString()}&limit=50`),
        apiFetch<AnalyticsSummary>(`/analytics/summary?${params.toString()}`),
        apiFetch<KeywordConfig[]>('/analytics/keywords'),
        apiFetch<{ data: Campaign[]; total: number }>('/campaigns'),
        apiFetch<{ data: Agent[]; total: number }>('/agents'),
      ]);

      setAnalytics(analyticsRes?.data || []);
      // Ensure all summary properties have default values
      setSummary({
        totalCalls: summaryRes?.totalCalls ?? 0,
        avgTalkRatio: summaryRes?.avgTalkRatio ?? 0,
        avgScriptAdherence: summaryRes?.avgScriptAdherence ?? 0,
        avgSilenceSeconds: summaryRes?.avgSilenceSeconds ?? 0,
        totalKeywordMatches: summaryRes?.totalKeywordMatches ?? 0,
        avgAgentWpm: summaryRes?.avgAgentWpm ?? 0,
        avgCustomerWpm: summaryRes?.avgCustomerWpm ?? 0,
        avgInterruptions: summaryRes?.avgInterruptions ?? 0,
      });
      setKeywords(Array.isArray(keywordsRes) ? keywordsRes : []);
      setCampaigns(campaignsRes?.data || []);
      setAgents(agentsRes?.data || []);
    } catch (err) {
      console.error('Failed to fetch analytics data:', err);
      // Set defaults on error
      setSummary({
        totalCalls: 0,
        avgTalkRatio: 0,
        avgScriptAdherence: 0,
        avgSilenceSeconds: 0,
        totalKeywordMatches: 0,
        avgAgentWpm: 0,
        avgCustomerWpm: 0,
        avgInterruptions: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [selectedCampaign, selectedAgent]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter analytics by search term
  const filteredAnalytics = analytics.filter((a) => {
    if (!searchTerm) return true;
    return a.callId.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Render helpers
  const getTalkRatioBadge = (ratio: number) => {
    if (ratio < 30) return <Badge className="bg-red-500">Low ({ratio}%)</Badge>;
    if (ratio > 70) return <Badge className="bg-yellow-500">High ({ratio}%)</Badge>;
    return <Badge className="bg-green-500">Balanced ({ratio}%)</Badge>;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  const getCategoryBadge = (category: string) => {
    const colors: Record<string, string> = {
      compliance: 'bg-blue-500',
      objection: 'bg-orange-500',
      positive: 'bg-green-500',
      negative: 'bg-red-500',
      competitor: 'bg-purple-500',
    };
    return <Badge className={colors[category] || 'bg-gray-500'}>{category}</Badge>;
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
          <h1 className="text-3xl font-bold tracking-tight">Speech Analytics</h1>
          <p className="text-muted-foreground">
            Analyze call transcripts for talk ratios, script adherence, and keywords
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
              <p className="text-xs text-muted-foreground mt-1">Total processed calls</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Mic className="h-4 w-4" />
                Avg Talk Ratio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.avgTalkRatio.toFixed(1)}%</div>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 bg-blue-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${summary.avgTalkRatio}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">Agent</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Script Adherence
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getScoreColor(summary.avgScriptAdherence)}`}>
                {summary.avgScriptAdherence.toFixed(1)}%
              </div>
              <Progress value={summary.avgScriptAdherence} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Keywords Detected
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalKeywordMatches}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Across {keywords.filter((k) => k.isActive).length} active keywords
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Additional Stats Row */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <VolumeX className="h-4 w-4" />
                Avg Silence
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatDuration(summary.avgSilenceSeconds)}</div>
              <p className="text-xs text-muted-foreground mt-1">Per call</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Volume2 className="h-4 w-4" />
                Agent WPM
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.avgAgentWpm.toFixed(0)}</div>
              <p className="text-xs text-muted-foreground mt-1">Words per minute</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                Customer WPM
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.avgCustomerWpm.toFixed(0)}</div>
              <p className="text-xs text-muted-foreground mt-1">Words per minute</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Avg Interruptions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.avgInterruptions.toFixed(1)}</div>
              <p className="text-xs text-muted-foreground mt-1">Per call</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">
            <BarChart3 className="w-4 h-4 mr-2" />
            Recent Analyses
          </TabsTrigger>
          <TabsTrigger value="keywords">
            <Filter className="w-4 h-4 mr-2" />
            Keywords
          </TabsTrigger>
        </TabsList>

        {/* Recent Analyses Tab */}
        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Call Analyses</CardTitle>
              <CardDescription>
                View speech analytics for individual calls
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredAnalytics.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No analytics data yet</p>
                  <p className="text-sm">
                    Call analytics will appear here once calls are processed
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Call ID</TableHead>
                      <TableHead>Talk Ratio</TableHead>
                      <TableHead>Script Score</TableHead>
                      <TableHead>Silence</TableHead>
                      <TableHead>Agent WPM</TableHead>
                      <TableHead>Interruptions</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Analyzed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAnalytics.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-mono text-sm">
                          {a.callId.slice(0, 8)}...
                        </TableCell>
                        <TableCell>{getTalkRatioBadge(a.talkRatio)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className={`font-medium ${getScoreColor(a.scriptAdherenceScore)}`}>
                              {a.scriptAdherenceScore.toFixed(0)}%
                            </span>
                            <Progress value={a.scriptAdherenceScore} className="w-12 h-2" />
                          </div>
                        </TableCell>
                        <TableCell>{formatDuration(a.totalSilenceSeconds)}</TableCell>
                        <TableCell>{a.agentWordsPerMinute.toFixed(0)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Badge variant="outline" className="text-xs">
                              A: {a.agentInterruptions}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              C: {a.customerInterruptions}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              a.status === 'completed'
                                ? 'bg-green-500'
                                : a.status === 'processing'
                                ? 'bg-blue-500'
                                : a.status === 'failed'
                                ? 'bg-red-500'
                                : 'bg-gray-500'
                            }
                          >
                            {a.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(a.analyzedAt || a.createdAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Keywords Tab */}
        <TabsContent value="keywords" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Keyword Configuration</CardTitle>
              <CardDescription>
                Keywords being tracked across call transcripts
              </CardDescription>
            </CardHeader>
            <CardContent>
              {keywords.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Filter className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No keywords configured</p>
                  <p className="text-sm">Add keywords to track in call transcripts</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Keyword</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {keywords.map((k) => (
                      <TableRow key={k.id}>
                        <TableCell className="font-medium">{k.keyword}</TableCell>
                        <TableCell>{getCategoryBadge(k.category)}</TableCell>
                        <TableCell>
                          {k.isActive ? (
                            <Badge className="bg-green-500">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
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
    </motion.div>
  );
}
