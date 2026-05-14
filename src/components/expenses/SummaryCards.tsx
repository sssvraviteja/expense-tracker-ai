"use client";

import { IndianRupee, PieChart, ReceiptIndianRupee } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Expense } from "@/types";

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", currencyDisplay: "narrowSymbol",
  minimumFractionDigits: 0, maximumFractionDigits: 2,
});

function biggestCategory(expenses: Expense[]): string {
  if (expenses.length === 0) return "—";
  const byCat = new Map<string, number>();
  for (const e of expenses) byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount);
  let top = "", topAmount = -1;
  for (const [cat, sum] of byCat) {
    if (sum > topAmount) { topAmount = sum; top = cat; }
  }
  return top;
}

function StatCard({ title, value, hint, icon: Icon }: {
  title: string; value: string; hint: string; icon: LucideIcon;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="size-4 text-muted-foreground" aria-hidden />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        <CardDescription className="mt-1">{hint}</CardDescription>
      </CardContent>
    </Card>
  );
}

export function SummaryCards({ expenses }: { expenses: Expense[] }) {
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const topCategory = biggestCategory(expenses);

  return (
    <section aria-label="Summary" className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard title="Total spent" value={currency.format(total)} hint="Sum of all listed expenses (INR)" icon={IndianRupee} />
      <StatCard title="Biggest category" value={topCategory} hint="Category with the highest total spend" icon={PieChart} />
      <StatCard title="Number of expenses" value={String(expenses.length)} hint="Entries in your current list" icon={ReceiptIndianRupee} />
    </section>
  );
}
