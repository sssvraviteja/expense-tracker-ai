"use client";

import { useEffect } from "react";
import { Brain, Lightbulb, TrendingUp, AlertTriangle, Eye, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useInsights, useMonthlySummary } from "@/hooks/useAI";
import type { Expense } from "@/types";
import type { InsightType } from "@/types/ai";

const INSIGHT_CONFIG: Record<InsightType, { icon: React.ComponentType<{ className?: string }>; color: string; badge: string }> = {
  pattern: { icon: TrendingUp, color: "text-blue-400", badge: "Pattern" },
  suggestion: { icon: Lightbulb, color: "text-yellow-400", badge: "Tip" },
  warning: { icon: AlertTriangle, color: "text-red-400", badge: "Alert" },
  observation: { icon: Eye, color: "text-purple-400", badge: "Observation" },
};

type Props = {
  expenses: Expense[];
};

export function AIInsightsPanel({ expenses }: Props) {
  const { insights, loading: insightsLoading, error: insightsError, fetchInsights } = useInsights();
  const { summary, loading: summaryLoading, error: summaryError, fetchSummary } = useMonthlySummary();

  const hasData = expenses.length > 0;

  function handleAnalyze() {
    if (!hasData) return;
    void fetchInsights(expenses);
    void fetchSummary(expenses);
  }

  // Auto-fetch when component mounts with data
  useEffect(() => {
    if (hasData && !insights && !insightsLoading) {
      void fetchInsights(expenses);
      void fetchSummary(expenses);
    }
    // We only want this to fire on initial mount with data
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasData]);

  if (!hasData) {
    return (
      <Card className="border-dashed border-border/50">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Brain className="size-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">Add expenses to unlock AI insights</p>
        </CardContent>
      </Card>
    );
  }

  const isLoading = insightsLoading || summaryLoading;

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-purple-400" />
          <h2 className="text-lg font-semibold">AI Analysis</h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleAnalyze}
          disabled={isLoading}
          className="h-8 gap-1.5 text-xs"
        >
          {isLoading ? (
            <><Loader2 className="size-3 animate-spin" />Analyzing…</>
          ) : (
            <><RefreshCw className="size-3" />Refresh</>
          )}
        </Button>
      </div>

      {/* Monthly Summary card */}
      {summaryLoading && !summary && (
        <SummaryCardSkeleton />
      )}
      {summary && (
        <Card className="border-purple-500/20 bg-purple-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-purple-300 flex items-center gap-1.5">
              <Brain className="size-3.5" />
              {summary.period}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm leading-relaxed text-foreground">{summary.narrative}</p>
            {summary.highlights.length > 0 && (
              <ul className="space-y-1">
                {summary.highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <span className="mt-0.5 shrink-0 size-1.5 rounded-full bg-purple-400" />
                    {h}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
      {summaryError && (
        <p className="text-xs text-destructive">{summaryError}</p>
      )}

      {/* Insights grid */}
      {insightsLoading && !insights && (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 3 }).map((_, i) => <InsightCardSkeleton key={i} />)}
        </div>
      )}
      {insights && insights.insights.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {insights.insights.map((insight, i) => {
            const config = INSIGHT_CONFIG[insight.type] ?? INSIGHT_CONFIG.observation;
            const Icon = config.icon;
            return (
              <Card key={i} className="bg-card/50">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">
                      <Icon className={`size-4 ${config.color}`} />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{insight.title}</span>
                        <Badge variant="secondary" className="text-xs h-4 px-1.5 py-0">
                          {config.badge}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {insight.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      {insightsError && (
        <p className="text-xs text-destructive">{insightsError}</p>
      )}
    </div>
  );
}

function SummaryCardSkeleton() {
  return (
    <Card className="border-purple-500/20">
      <CardHeader className="pb-2">
        <div className="h-4 w-32 rounded bg-muted animate-pulse" />
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="h-3 w-full rounded bg-muted animate-pulse" />
        <div className="h-3 w-4/5 rounded bg-muted animate-pulse" />
        <div className="h-3 w-2/3 rounded bg-muted animate-pulse" />
      </CardContent>
    </Card>
  );
}

function InsightCardSkeleton() {
  return (
    <Card className="bg-card/50">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-3">
          <div className="size-4 rounded-full bg-muted animate-pulse mt-0.5 shrink-0" />
          <div className="space-y-2 flex-1">
            <div className="h-3.5 w-3/4 rounded bg-muted animate-pulse" />
            <div className="h-3 w-full rounded bg-muted animate-pulse" />
            <div className="h-3 w-4/5 rounded bg-muted animate-pulse" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
