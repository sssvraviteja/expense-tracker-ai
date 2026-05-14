"use client";

import { useState } from "react";
import { IndianRupee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CATEGORY_OPTIONS } from "@/types";
import type { AddExpenseInput } from "@/hooks/useExpenses";

function getTodayIsoDate() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

type Props = {
  onAdd: (input: AddExpenseInput) => Promise<{ error: string | null }>;
  disabled?: boolean;
};

export function AddExpenseForm({ onAdd, disabled }: Props) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>(CATEGORY_OPTIONS[0]);
  const [date, setDate] = useState(getTodayIsoDate);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = Number.parseFloat(amount);
    if (!description.trim() || Number.isNaN(parsed) || parsed <= 0) return;

    setSaving(true);
    const { error } = await onAdd({
      amount: Math.round(parsed * 100) / 100,
      description: description.trim(),
      category,
      date,
    });
    setSaving(false);

    if (!error) {
      setAmount("");
      setDescription("");
      setCategory(CATEGORY_OPTIONS[0]);
      setDate(getTodayIsoDate());
    }
  }

  const busy = saving || disabled;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Add expense</CardTitle>
        <CardDescription>Submit the form to save to Supabase.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="amount" className="flex items-center gap-1.5 text-sm font-medium">
              <IndianRupee className="size-3.5 text-muted-foreground" aria-hidden />
              Amount (INR)
            </label>
            <Input id="amount" type="number" inputMode="decimal" min="0" step="0.01"
              placeholder="e.g. 500" value={amount} onChange={e => setAmount(e.target.value)} className="h-10" />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="description" className="text-sm font-medium">Description</label>
            <Input id="description" type="text" placeholder="What did you pay for?"
              value={description} onChange={e => setDescription(e.target.value)} className="h-10" />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="category" className="text-sm font-medium">Category</label>
            <select id="category" value={category} onChange={e => setCategory(e.target.value)}
              className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30">
              {CATEGORY_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="date" className="text-sm font-medium">Date</label>
            <Input id="date" type="date" value={date} onChange={e => setDate(e.target.value)} className="h-10" />
          </div>

          <Button type="submit" className="mt-2 w-full h-10" size="lg" disabled={!!busy}>
            {saving ? "Saving…" : "Add Expense"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
