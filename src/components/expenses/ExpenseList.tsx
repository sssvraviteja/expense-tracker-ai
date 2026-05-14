"use client";

import { useMemo } from "react";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Expense } from "@/types";

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", currencyDisplay: "narrowSymbol",
  minimumFractionDigits: 0, maximumFractionDigits: 2,
});

function formatDisplayDate(isoDate: string) {
  const d = new Date(`${isoDate}T12:00:00`);
  return d.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });
}

type Props = {
  expenses: Expense[];
  loading: boolean;
  deletingId: string | null;
  onEdit: (expense: Expense) => void;
  onDelete: (id: string) => void;
};

export function ExpenseList({ expenses, loading, deletingId, onEdit, onDelete }: Props) {
  const sorted = useMemo(() => [...expenses].sort((a, b) => b.date.localeCompare(a.date)), [expenses]);

  return (
    <Card className="lg:col-span-3">
      <CardHeader>
        <CardTitle className="text-lg">Recent expenses</CardTitle>
        <CardDescription>Newest dates first.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading expenses…
          </div>
        ) : sorted.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm font-medium text-muted-foreground">No expenses yet.</p>
            <p className="mt-1 text-xs text-muted-foreground">Add one using the form on the left.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {sorted.map(item => (
              <li key={item.id}
                className="flex flex-col gap-3 p-4 first:rounded-t-xl last:rounded-b-xl sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate font-medium">{item.description}</p>
                  <p className="text-sm text-muted-foreground">{formatDisplayDate(item.date)}</p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                  <Badge variant="secondary">{item.category}</Badge>
                  <span className="text-base font-semibold tabular-nums">{currency.format(item.amount)}</span>
                  <Button type="button" variant="ghost" size="icon-sm"
                    className="text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label={`Edit ${item.description}`}
                    disabled={deletingId !== null}
                    onClick={() => onEdit(item)}>
                    <Pencil className="size-4" aria-hidden />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm"
                    className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Delete ${item.description}`}
                    aria-busy={deletingId === item.id}
                    disabled={deletingId !== null}
                    onClick={() => onDelete(item.id)}>
                    {deletingId === item.id
                      ? <Loader2 className="size-4 animate-spin" aria-hidden />
                      : <Trash2 className="size-4" aria-hidden />}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
