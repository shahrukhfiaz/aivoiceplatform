'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  PlusCircle,
  Trash2,
  ClipboardCheck,
  FileText,
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Edit,
  Eye,
} from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
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
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

// ==================== Types ====================

interface ScorecardCriterion {
  id: string;
  question: string;
  type: 'yes_no' | 'scale_1_5' | 'scale_1_10';
  points: number;
  required: boolean;
}

interface ScorecardCategory {
  id: string;
  name: string;
  weight: number;
  criteria: ScorecardCriterion[];
}

interface QaScorecard {
  id: string;
  name: string;
  description?: string | null;
  categories: ScorecardCategory[];
  maxScore: number;
  passingScore: number;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CriterionScore {
  criterionId: string;
  categoryId: string;
  score: number;
  maxScore: number;
  notes?: string;
}

type EvaluationStatus = 'draft' | 'completed' | 'disputed' | 'acknowledged';

interface QaEvaluation {
  id: string;
  callId: string;
  scorecardId: string;
  scorecard: QaScorecard;
  evaluatorId: string;
  evaluator: { id: string; username: string };
  agentId?: string;
  campaignId?: string;
  scores: CriterionScore[];
  totalScore: number;
  rawScore: number;
  maxPossibleScore: number;
  passed: boolean;
  status: EvaluationStatus;
  evaluatorComments?: string | null;
  agentFeedback?: string | null;
  acknowledgedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface QaStats {
  totalEvaluations: number;
  averageScore: number;
  passRate: number;
  evaluationsByStatus: Record<string, number>;
}

// ==================== Schemas ====================

const criterionSchema = z.object({
  id: z.string(),
  question: z.string().min(1, 'Question is required'),
  type: z.enum(['yes_no', 'scale_1_5', 'scale_1_10']),
  points: z.number().min(1),
  required: z.boolean(),
});

const categorySchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Category name is required'),
  weight: z.number().min(0).max(100),
  criteria: z.array(criterionSchema),
});

const scorecardFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  categories: z.array(categorySchema),
  passingScore: z.number().min(0).max(100),
  isActive: z.boolean(),
  isDefault: z.boolean(),
});

type ScorecardFormValues = z.infer<typeof scorecardFormSchema>;

// ==================== Component ====================

export default function QaPage() {
  const [loading, setLoading] = useState(true);
  const [scorecards, setScorecards] = useState<QaScorecard[]>([]);
  const [evaluations, setEvaluations] = useState<QaEvaluation[]>([]);
  const [stats, setStats] = useState<QaStats | null>(null);
  const [activeTab, setActiveTab] = useState('evaluations');

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editScorecard, setEditScorecard] = useState<QaScorecard | null>(null);
  const [deleteScorecard, setDeleteScorecard] = useState<QaScorecard | null>(null);
  const [viewEvaluation, setViewEvaluation] = useState<QaEvaluation | null>(null);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);

    try {
      const [scorecardsRes, evaluationsRes, statsRes] = await Promise.all([
        apiFetch<QaScorecard[]>('/qa/scorecards'),
        apiFetch<QaEvaluation[]>('/qa/evaluations'),
        apiFetch<QaStats>('/qa/stats'),
      ]);

      setScorecards(scorecardsRes);
      setEvaluations(evaluationsRes);
      setStats(statsRes);
    } catch (err) {
      console.error('Failed to fetch QA data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Form setup
  const defaultFormValues: ScorecardFormValues = {
    name: '',
    description: '',
    categories: [
      {
        id: `cat-${Date.now()}`,
        name: 'General',
        weight: 100,
        criteria: [
          {
            id: `crit-${Date.now()}`,
            question: 'Sample question',
            type: 'yes_no',
            points: 10,
            required: true,
          },
        ],
      },
    ],
    passingScore: 70,
    isActive: true,
    isDefault: false,
  };

  const form = useForm<ScorecardFormValues>({
    resolver: zodResolver(scorecardFormSchema),
    defaultValues: defaultFormValues,
  });

  // Handlers
  const handleCreateScorecard = async (data: ScorecardFormValues) => {
    try {
      await apiFetch('/qa/scorecards', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      setCreateDialogOpen(false);
      form.reset(defaultFormValues);
      fetchData();
    } catch (err) {
      console.error('Failed to create scorecard:', err);
    }
  };

  const handleUpdateScorecard = async (data: ScorecardFormValues) => {
    if (!editScorecard) return;

    try {
      await apiFetch(`/qa/scorecards/${editScorecard.id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });

      setEditScorecard(null);
      form.reset(defaultFormValues);
      fetchData();
    } catch (err) {
      console.error('Failed to update scorecard:', err);
    }
  };

  const handleDeleteScorecard = async () => {
    if (!deleteScorecard) return;

    try {
      await apiFetch(`/qa/scorecards/${deleteScorecard.id}`, {
        method: 'DELETE',
      });

      setDeleteScorecard(null);
      fetchData();
    } catch (err) {
      console.error('Failed to delete scorecard:', err);
    }
  };

  const openEditDialog = (scorecard: QaScorecard) => {
    form.reset({
      name: scorecard.name,
      description: scorecard.description || '',
      categories: scorecard.categories,
      passingScore: scorecard.passingScore,
      isActive: scorecard.isActive,
      isDefault: scorecard.isDefault,
    });
    setEditScorecard(scorecard);
  };

  // Render helpers
  const getStatusBadge = (status: EvaluationStatus) => {
    const styles: Record<EvaluationStatus, string> = {
      draft: 'bg-gray-500',
      completed: 'bg-blue-500',
      disputed: 'bg-orange-500',
      acknowledged: 'bg-green-500',
    };
    return (
      <Badge className={styles[status]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getPassBadge = (passed: boolean) => {
    return passed ? (
      <Badge className="bg-green-500">
        <CheckCircle2 className="w-3 h-3 mr-1" />
        Pass
      </Badge>
    ) : (
      <Badge className="bg-red-500">
        <XCircle className="w-3 h-3 mr-1" />
        Fail
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
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
          <h1 className="text-3xl font-bold tracking-tight">Quality Assurance</h1>
          <p className="text-muted-foreground">
            Manage QA scorecards and call evaluations
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="w-4 h-4 mr-2" />
              New Scorecard
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create QA Scorecard</DialogTitle>
              <DialogDescription>
                Create a new scorecard for evaluating call quality
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleCreateScorecard)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Scorecard Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Sales Call Scorecard" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe the purpose of this scorecard..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="passingScore"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Passing Score (%)</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} max={100} {...field} />
                      </FormControl>
                      <FormDescription>
                        Minimum percentage score required to pass QA
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-4">
                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2">
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="!mt-0">Active</FormLabel>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="isDefault"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2">
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="!mt-0">Default Scorecard</FormLabel>
                      </FormItem>
                    )}
                  />
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Create Scorecard</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Evaluations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalEvaluations}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Average Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.averageScore.toFixed(1)}%</div>
              <Progress value={stats.averageScore} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pass Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.passRate.toFixed(1)}%</div>
              <Progress value={stats.passRate} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Scorecards
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {scorecards.filter((s) => s.isActive).length}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="evaluations">
            <ClipboardCheck className="w-4 h-4 mr-2" />
            Evaluations
          </TabsTrigger>
          <TabsTrigger value="scorecards">
            <FileText className="w-4 h-4 mr-2" />
            Scorecards
          </TabsTrigger>
        </TabsList>

        {/* Evaluations Tab */}
        <TabsContent value="evaluations" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Evaluations</CardTitle>
              <CardDescription>
                View and manage call quality evaluations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {evaluations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No evaluations yet</p>
                  <p className="text-sm">
                    Evaluations will appear here when calls are scored
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Call ID</TableHead>
                      <TableHead>Scorecard</TableHead>
                      <TableHead>Evaluator</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Result</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {evaluations.map((evaluation) => (
                      <TableRow key={evaluation.id}>
                        <TableCell className="font-mono text-sm">
                          {evaluation.callId.slice(0, 8)}...
                        </TableCell>
                        <TableCell>{evaluation.scorecard?.name || 'N/A'}</TableCell>
                        <TableCell>{evaluation.evaluator?.username || 'N/A'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{evaluation.totalScore.toFixed(1)}%</span>
                            <Progress value={evaluation.totalScore} className="w-16 h-2" />
                          </div>
                        </TableCell>
                        <TableCell>{getPassBadge(evaluation.passed)}</TableCell>
                        <TableCell>{getStatusBadge(evaluation.status)}</TableCell>
                        <TableCell>
                          {new Date(evaluation.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setViewEvaluation(evaluation)}
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

        {/* Scorecards Tab */}
        <TabsContent value="scorecards" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>QA Scorecards</CardTitle>
              <CardDescription>
                Manage evaluation templates and scoring criteria
              </CardDescription>
            </CardHeader>
            <CardContent>
              {scorecards.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No scorecards yet</p>
                  <p className="text-sm">Create a scorecard to start evaluating calls</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Categories</TableHead>
                      <TableHead>Passing Score</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scorecards.map((scorecard) => (
                      <TableRow key={scorecard.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{scorecard.name}</span>
                            {scorecard.isDefault && (
                              <Badge variant="outline" className="text-xs">Default</Badge>
                            )}
                          </div>
                          {scorecard.description && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {scorecard.description}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          {scorecard.categories.length} categories,{' '}
                          {scorecard.categories.reduce((sum, c) => sum + c.criteria.length, 0)} criteria
                        </TableCell>
                        <TableCell>{scorecard.passingScore}%</TableCell>
                        <TableCell>
                          {scorecard.isActive ? (
                            <Badge className="bg-green-500">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {new Date(scorecard.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(scorecard)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteScorecard(scorecard)}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
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

      {/* Edit Scorecard Dialog */}
      <Dialog open={!!editScorecard} onOpenChange={(open) => !open && setEditScorecard(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Scorecard</DialogTitle>
            <DialogDescription>
              Update scorecard settings
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleUpdateScorecard)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Scorecard Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="passingScore"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Passing Score (%)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} max={100} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-4">
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="!mt-0">Active</FormLabel>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isDefault"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="!mt-0">Default Scorecard</FormLabel>
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditScorecard(null)}>
                  Cancel
                </Button>
                <Button type="submit">Save Changes</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* View Evaluation Dialog */}
      <Dialog open={!!viewEvaluation} onOpenChange={(open) => !open && setViewEvaluation(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Evaluation Details</DialogTitle>
            <DialogDescription>
              Call ID: {viewEvaluation?.callId}
            </DialogDescription>
          </DialogHeader>

          {viewEvaluation && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Score</Label>
                  <div className="text-2xl font-bold">
                    {viewEvaluation.totalScore.toFixed(1)}%
                  </div>
                  <Progress value={viewEvaluation.totalScore} className="mt-1" />
                </div>
                <div>
                  <Label className="text-muted-foreground">Result</Label>
                  <div className="mt-1">{getPassBadge(viewEvaluation.passed)}</div>
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground">Scorecard</Label>
                <p>{viewEvaluation.scorecard?.name || 'N/A'}</p>
              </div>

              <div>
                <Label className="text-muted-foreground">Evaluator</Label>
                <p>{viewEvaluation.evaluator?.username || 'N/A'}</p>
              </div>

              {viewEvaluation.evaluatorComments && (
                <div>
                  <Label className="text-muted-foreground">Comments</Label>
                  <p className="text-sm mt-1 p-2 bg-muted rounded">
                    {viewEvaluation.evaluatorComments}
                  </p>
                </div>
              )}

              {viewEvaluation.agentFeedback && (
                <div>
                  <Label className="text-muted-foreground">Agent Feedback</Label>
                  <p className="text-sm mt-1 p-2 bg-muted rounded">
                    {viewEvaluation.agentFeedback}
                  </p>
                </div>
              )}

              <div>
                <Label className="text-muted-foreground">Status</Label>
                <div className="mt-1">{getStatusBadge(viewEvaluation.status)}</div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setViewEvaluation(null)}>
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteScorecard} onOpenChange={(open) => !open && setDeleteScorecard(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Scorecard</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteScorecard?.name}&quot;? This action cannot be
              undone. Scorecards with evaluations cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteScorecard}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
