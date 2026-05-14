"use client";

import { useEffect, useState } from "react";
import { IndianRupee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CATEGORY_OPTIONS } from "@/types";
import type { Expense } from "@/types";
import type { AddExpenseInput } from "@/hooks/useExpenses";

type Props = {
  expense: Expense;
  onSave: (id: string, input: AddExpenseInput) => Promise<{ error: string | null }>;
  onClose: () => void;
};

export function EditExpenseModal({ expense, onSave, onClose }: Props) {
  const [amount, setAmount] = useState(String(expense.amount));
  const [description, setDescription] = useState(expense.description);
  const [category, setCategory] = useState(expense.category);
  const [date, setDate] = useState(expense.date);
  const [saving, setSaving] = useState(false);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saving, onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = Number.parseFloat(amount);
    if (!description.trim() || Number.isNaN(parsed) || parsed <= 0) return;

    setSaving(true);
    const { error } = await onSave(expense.id, {
      amount: Math.round(parsed * 100) / 100,
      description: description.trim(),
      category,
      date,
    });
    setSaving(false);
    if (!error) onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog" aria-modal="true" aria-labelledby="edit-modal-title">
      {/* Backdrop */}
      <button type="button"
        className="absolute inset-0 bg-background/85 backdrop-blur-sm"
        aria-label="Close edit" disabled={saving}
        onClick={() => { if (!saving) onClose(); }} />

      <Card className="relative z-10 w-full max-w-md shadow-xl ring-1 ring-border">
        <CardHeader>
          <CardTitle id="edit-modal-title" className="text-lg">Edit expense</CardTitle>
          <CardDescription>Update fields and save to Supabase.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="edit-amount" className="flex items-center gap-1.5 text-sm font-medium">
                <IndianRupee className="size-3.5 text-muted-foreground" aria-hidden />
                Amount (INR)
              </label>
              <Input id="edit-amount" type="number" inputMode="decimal" min="0" step="0.01"
                value={amount} onChange={e => setAmount(e.target.value)} className="h-10" />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="edit-description" className="text-sm font-medium">Description</label>
              <Input id="edit-description" type="text"
                value={description} onChange={e => setDescription(e.target.value)} className="h-10" />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="edit-category" className="text-sm font-medium">Category</label>
              <select id="edit-category" value={category} onChange={e => setCategory(e.target.value)}
                className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30">
                {CATEGORY_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="edit-date" className="text-sm font-medium">Date</label>
              <Input id="edit-date" type="date" value={date}
                onChange={e => setDate(e.target.value)} className="h-10" />
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1"
                disabled={saving} onClick={() => { if (!saving) onClose(); }}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
