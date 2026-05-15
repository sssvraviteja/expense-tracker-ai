"use client";

import { useRef, useState } from "react";
import { IndianRupee, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CATEGORY_OPTIONS } from "@/types";
import type { AddExpenseInput } from "@/hooks/useExpenses";
import { useCategorize } from "@/hooks/useAI";

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
  const [aiCategorized, setAiCategorized] = useState(false);

  const { categorize, loading: aiLoading } = useCategorize();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleDescriptionChange(value: string) {
    setDescription(value);
    setAiCategorized(false);

    // Debounce: auto-categorize 600ms after user stops typing
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length >= 2) {
      debounceRef.current = setTimeout(async () => {
        const suggested = await categorize(value.trim());
        if (suggested && CATEGORY_OPTIONS.includes(suggested as typeof CATEGORY_OPTIONS[number])) {
          setCategory(suggested);
          setAiCategorized(true);
        }
      }, 600);
    }
  }

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
      setAiCategorized(false);
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
            <div className="relative">
              <Input id="description" type="text" placeholder="What did you pay for?"
                value={description} onChange={e => handleDescriptionChange(e.target.value)} className="h-10 pr-8" />
              {aiLoading && (
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
                  <span className="size-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin block" />
                </span>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="category" className="text-sm font-medium">Category</label>
              {aiCategorized && (
                <span className="flex items-center gap-1 text-xs text-purple-400">
                  <Sparkles className="size-3" />AI suggested
                </span>
              )}
            </div>
            <select id="category" value={category}
              onChange={e => { setCategory(e.target.value); setAiCategorized(false); }}
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
