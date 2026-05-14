"use client";

import { useMemo } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Expense } from "@/types";

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", currencyDisplay: "narrowSymbol",
  minimumFractionDigits: 0, maximumFractionDigits: 2,
});

const CHART_AXIS_TICK = { fontSize: 11, fill: "oklch(0.708 0 0)" };
const CHART_TOOLTIP_STYLE = {
  backgroundColor: "oklch(0.205 0 0)",
  border: "1px solid oklch(1 0 0 / 12%)",
  borderRadius: 8, fontSize: 12,
};
const PIE_COLORS = [
  "oklch(0.488 0.243 264.376)", "oklch(0.696 0.17 162.48)",
  "oklch(0.769 0.188 70.08)", "oklch(0.627 0.265 303.9)",
  "oklch(0.577 0.245 27.325)", "oklch(0.708 0 0)", "oklch(0.828 0.189 84.429)",
];

function formatMonthLabel(yyyyMm: string) {
  const [ys, ms] = yyyyMm.split("-");
  const y = Number(ys), m = Number(ms);
  if (!y || !m) return yyyyMm;
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

function buildMonthlyTotals(expenses: Expense[]) {
  const map = new Map<string, number>();
  for (const e of expenses) {
    const key = e.date.length >= 7 ? e.date.slice(0, 7) : e.date;
    map.set(key, (map.get(key) ?? 0) + e.amount);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, total]) => ({ month, label: formatMonthLabel(month), total }));
}

function buildCategoryTotals(expenses: Expense[]) {
  const map = new Map<string, number>();
  for (const e of expenses) map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
  return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

function compactInrAxis(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: value >= 1000 ? 0 : 2 }).format(value);
}

export function ExpenseCharts({ expenses }: { expenses: Expense[] }) {
  const monthly = useMemo(() => buildMonthlyTotals(expenses), [expenses]);
  const byCategory = useMemo(() => buildCategoryTotals(expenses), [expenses]);
  const empty = expenses.length === 0;

  return (
    <section aria-label="Expense charts" className="mb-10 grid gap-6 lg:grid-cols-2">
      <Card className="min-h-[320px]">
        <CardHeader>
          <CardTitle className="text-lg">Monthly spending</CardTitle>
          <CardDescription>Total INR per calendar month</CardDescription>
        </CardHeader>
        <CardContent className="h-[260px]">
          {empty ? (
            <p className="text-sm text-muted-foreground">Add expenses to see monthly totals.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 8%)" vertical={false} />
                <XAxis dataKey="label" tick={CHART_AXIS_TICK} axisLine={{ stroke: "oklch(1 0 0 / 15%)" }} tickLine={false} />
                <YAxis width={52} tick={CHART_AXIS_TICK} tickFormatter={(v: number | string) => compactInrAxis(Number(v))} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number | string) => currency.format(Number(v))} />
                <Bar dataKey="total" name="Spent" fill="oklch(0.922 0 0)" radius={[4, 4, 0, 0]} maxBarSize={52} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="min-h-[320px]">
        <CardHeader>
          <CardTitle className="text-lg">By category</CardTitle>
          <CardDescription>How spending splits across categories</CardDescription>
        </CardHeader>
        <CardContent className="h-[260px]">
          {empty ? (
            <p className="text-sm text-muted-foreground">Add expenses to see category shares.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byCategory} dataKey="value" nameKey="name" cx="50%" cy="50%"
                  innerRadius={52} outerRadius={86} paddingAngle={2}
                  stroke="oklch(0.205 0 0)" strokeWidth={1}>
                  {byCategory.map((entry, i) => (
                    <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number | string) => currency.format(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 12, color: "oklch(0.708 0 0)" }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
