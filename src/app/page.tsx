"use client";

import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  IndianRupee,
  Loader2,
  Pencil,
  PieChart as PieChartIcon,
  ReceiptIndianRupee,
  Trash2,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";

/**
 * Supabase: table `public.expenses` must expose these columns to PostgREST.
 * This project uses the column name **`date`** for the calendar day (many
 * starter schemas use `date` instead of `expense_date`).
 *
 *   create table public.expenses (
 *     id uuid primary key default gen_random_uuid(),
 *     amount numeric not null,
 *     description text not null,
 *     category text not null,
 *     "date" date not null
 *   );
 *
 *   alter table public.expenses enable row level security;
 *   create policy "read expenses" on public.expenses for select using (true);
 *   create policy "insert expenses" on public.expenses for insert with check (true);
 *   create policy "delete expenses" on public.expenses for delete using (true);
 *   create policy "update expenses" on public.expenses for update using (true) with check (true);
 *
 * If you prefer `expense_date`, add that column (or rename) in Supabase and
 * change the `.select()` / `.insert()` field names below to match.
 *
 * Common insert failures:
 * - RLS: INSERT allowed but SELECT blocked → `.select().single()` returns PGRST116 / 406.
 * - Wrong column names / table not in `public` / typo in table name.
 * - Anon role missing INSERT or SELECT grants on the table.
 *
 * Tighten RLS for production (e.g. only rows where user_id = auth.uid()).
 */

type Expense = {
  id: string;
  amount: number;
  description: string;
  category: string;
  /** YYYY-MM-DD */
  date: string;
};

/** One row as returned by Supabase (snake_case except our column is `date`) */
type ExpenseRow = {
  id: string;
  amount: number | string;
  description: string;
  category: string;
  date: string;
};

const CATEGORY_OPTIONS = [
  "Food",
  "Petrol",
  "Rent",
  "UPI Payments",
  "Shopping",
  "Travel",
  "Recharge",
] as const;

/** Indian digit grouping and ₹ (e.g. ₹1,25,000) */
const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  currencyDisplay: "narrowSymbol",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function formatDisplayDate(isoDate: string) {
  const d = new Date(`${isoDate}T12:00:00`);
  return d.toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Today as YYYY-MM-DD for the date input */
function getTodayIsoDate() {
  const t = new Date();
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, "0");
  const d = String(t.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * PostgreSQL `date` columns (and PostgREST) expect a plain calendar string
 * `YYYY-MM-DD` — never locale strings like DD/MM/YYYY.
 * Also strips time from ISO timestamps Supabase may return.
 */
function toPostgresDateOnly(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Expense date is empty");
  }

  // "2026-05-14T00:00:00+00:00" or "2026-05-14 00:00:00" → date part only
  const isoDatePrefix = /^(\d{4}-\d{2}-\d{2})(?:[T\s]|$)/.exec(trimmed);
  if (isoDatePrefix) {
    return isoDatePrefix[1];
  }

  // Typical value from <input type="date" />
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (ymd) {
    return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
  }

  // Fallback: local calendar fields (avoids UTC shifting the day)
  const dt = new Date(trimmed);
  if (Number.isNaN(dt.getTime())) {
    throw new Error(`Invalid date: "${raw}"`);
  }
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Serialize PostgREST / network errors for console output */
function serializeError(err: unknown) {
  if (
    err &&
    typeof err === "object" &&
    "toJSON" in err &&
    typeof (err as { toJSON: () => unknown }).toJSON === "function"
  ) {
    return (err as { toJSON: () => unknown }).toJSON();
  }
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  return err;
}

type InsertPayload = {
  amount: number;
  description: string;
  category: string;
  /** DB column `date` — value is always YYYY-MM-DD for PostgreSQL */
  date: string;
};

/** Full PostgREST response after insert + select (status, body, error) */
function logExpenseInsertPostgrestResponse(
  result: {
    status: number;
    statusText: string;
    data: unknown;
    error: unknown;
    count: number | null;
  },
  payload: InsertPayload,
) {
  const summary = {
    httpStatus: result.status,
    httpStatusText: result.statusText,
    rowCount: result.count,
    hasData: result.data != null,
    data: result.data,
    hasError: result.error != null,
    error: result.error ? serializeError(result.error) : null,
  };

  if (result.error != null) {
    console.error("[expenses insert] PostgREST response (failure)", {
      sentPayload: payload,
      ...summary,
      rawError: result.error,
    });
  } else {
    console.info("[expenses insert] PostgREST response (success)", {
      sentPayload: payload,
      ...summary,
    });
  }
}

/** Unexpected throw before/after PostgREST (e.g. mapping bug) */
function logExpenseInsertUnexpected(err: unknown, payload: InsertPayload) {
  console.error("[expenses insert] unexpected exception", {
    sentPayload: payload,
    error: serializeError(err),
    raw: err,
  });
}

/** Turn a database row into the shape our React code already uses */
function rowToExpense(row: ExpenseRow): Expense {
  const rawDate = row.date != null ? String(row.date) : "";
  let dateNormalized: string;
  try {
    dateNormalized = toPostgresDateOnly(rawDate);
  } catch {
    // Rare: unexpected DB shape — still show something stable in the UI
    dateNormalized = rawDate.slice(0, 10);
    console.warn("[expenses] Could not normalize date column", {
      raw: row.date,
    });
  }

  return {
    id: row.id,
    amount: Number(row.amount),
    description: row.description,
    category: row.category,
    date: dateNormalized,
  };
}

function biggestCategoryBySpend(expenses: Expense[]): string {
  if (expenses.length === 0) return "—";
  const byCat = new Map<string, number>();
  for (const e of expenses) {
    byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount);
  }
  let top = "";
  let topAmount = -1;
  for (const [cat, sum] of byCat) {
    if (sum > topAmount) {
      topAmount = sum;
      top = cat;
    }
  }
  return top;
}

const CHART_AXIS_TICK = { fontSize: 11, fill: "oklch(0.708 0 0)" };
const CHART_TOOLTIP_STYLE = {
  backgroundColor: "oklch(0.205 0 0)",
  border: "1px solid oklch(1 0 0 / 12%)",
  borderRadius: 8,
  fontSize: 12,
};

const PIE_COLORS = [
  "oklch(0.488 0.243 264.376)",
  "oklch(0.696 0.17 162.48)",
  "oklch(0.769 0.188 70.08)",
  "oklch(0.627 0.265 303.9)",
  "oklch(0.577 0.245 27.325)",
  "oklch(0.708 0 0)",
  "oklch(0.828 0.189 84.429)",
];

function formatMonthLabel(yyyyMm: string) {
  const [ys, ms] = yyyyMm.split("-");
  const y = Number(ys);
  const m = Number(ms);
  if (!y || !m) return yyyyMm;
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
  });
}

/** One bar per YYYY-MM bucket */
function buildMonthlyTotals(expenses: Expense[]) {
  const map = new Map<string, number>();
  for (const e of expenses) {
    const key = e.date.length >= 7 ? e.date.slice(0, 7) : e.date;
    map.set(key, (map.get(key) ?? 0) + e.amount);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, total]) => ({
      month,
      label: formatMonthLabel(month),
      total,
    }));
}

/** One slice per category */
function buildCategoryTotals(expenses: Expense[]) {
  const map = new Map<string, number>();
  for (const e of expenses) {
    map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function compactInrAxis(value: number) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

function ExpenseCharts({ expenses }: { expenses: Expense[] }) {
  const monthly = useMemo(() => buildMonthlyTotals(expenses), [expenses]);
  const byCategory = useMemo(() => buildCategoryTotals(expenses), [expenses]);
  const empty = expenses.length === 0;

  return (
    <section
      aria-label="Expense charts"
      className="mb-10 grid gap-6 lg:grid-cols-2"
    >
      <Card className="min-h-[320px]">
        <CardHeader>
          <CardTitle className="text-lg">Monthly spending</CardTitle>
          <CardDescription>Total INR per calendar month</CardDescription>
        </CardHeader>
        <CardContent className="h-[260px]">
          {empty ? (
            <p className="text-sm text-muted-foreground">
              Add expenses to see monthly totals.
            </p>
          ) : monthly.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No dated expenses to chart yet.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={monthly}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="oklch(1 0 0 / 8%)"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={CHART_AXIS_TICK}
                  axisLine={{ stroke: "oklch(1 0 0 / 15%)" }}
                  tickLine={false}
                />
                <YAxis
                  width={52}
                  tick={CHART_AXIS_TICK}
                  tickFormatter={(v: number | string) =>
                    compactInrAxis(Number(v))
                  }
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  formatter={(value: number | string) =>
                    currency.format(Number(value))
                  }
                />
                <Bar
                  dataKey="total"
                  name="Spent"
                  fill="oklch(0.922 0 0)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={52}
                />
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
            <p className="text-sm text-muted-foreground">
              Add expenses to see category shares.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={byCategory}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={86}
                  paddingAngle={2}
                  stroke="oklch(0.205 0 0)"
                  strokeWidth={1}
                >
                  {byCategory.map((entry, i) => (
                    <Cell
                      key={entry.name}
                      fill={PIE_COLORS[i % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  formatter={(value: number | string) =>
                    currency.format(Number(value))
                  }
                />
                <Legend
                  wrapperStyle={{ fontSize: 12, color: "oklch(0.708 0 0)" }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function SummaryCard({
  title,
  value,
  hint,
  icon: Icon,
}: {
  title: string;
  value: string;
  hint: string;
  icon: LucideIcon;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="size-4 text-muted-foreground" aria-hidden />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        <CardDescription className="mt-1">{hint}</CardDescription>
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  /** Which expense id is currently being deleted (null = none) */
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /** Modal edit: which row is open (null = closed) */
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState<string>(CATEGORY_OPTIONS[0]);
  const [editDate, setEditDate] = useState("");

  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>(CATEGORY_OPTIONS[0]);
  const [date, setDate] = useState(getTodayIsoDate);

  // Close the edit modal with Escape (when not saving)
  useEffect(() => {
    if (!editingExpense) return;
    function onKeyDown(ev: KeyboardEvent) {
      if (ev.key === "Escape" && !isUpdating) {
        setEditingExpense(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editingExpense, isUpdating]);

  // Load all expenses once when the page opens
  useEffect(() => {
    let cancelled = false;

    async function loadExpenses() {
      setErrorMessage(null);
      setIsLoadingList(true);
      try {
        const { data, error } = await supabase
          .from("expenses")
          .select("id, amount, description, category, date")
          .order("date", { ascending: false });

        if (error) {
          throw error;
        }

        const rows = (data ?? []) as ExpenseRow[];
        const list = rows.map(rowToExpense);

        if (!cancelled) {
          setExpenses(list);
        }
      } catch (err) {
        if (!cancelled) {
          setErrorMessage(
            err instanceof Error ? err.message : "Could not load expenses.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingList(false);
        }
      }
    }

    void loadExpenses();

    return () => {
      cancelled = true;
    };
  }, []);

  const totalSpent = useMemo(
    () => expenses.reduce((sum, e) => sum + e.amount, 0),
    [expenses],
  );

  const topCategory = useMemo(
    () => biggestCategoryBySpend(expenses),
    [expenses],
  );

  const expenseCount = expenses.length;

  // Remove one row in Supabase, then drop it from local state so the list & summaries update
  async function handleDeleteExpense(id: string) {
    setErrorMessage(null);
    setDeletingId(id);

    try {
      const { error } = await supabase.from("expenses").delete().eq("id", id);

      if (error) {
        throw error;
      }

      setExpenses((prev) => prev.filter((expense) => expense.id !== id));
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Could not delete expense.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function handleUpdateExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!editingExpense) return;

    const parsed = Number.parseFloat(editAmount);
    if (!editDescription.trim() || Number.isNaN(parsed) || parsed <= 0) {
      return;
    }

    const roundedAmount = Math.round(parsed * 100) / 100;
    const trimmedDescription = editDescription.trim();

    let dateIso: string;
    try {
      dateIso = toPostgresDateOnly(editDate);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Invalid expense date.",
      );
      return;
    }

    const updatePayload: InsertPayload = {
      amount: roundedAmount,
      description: trimmedDescription,
      category: editCategory,
      date: dateIso,
    };

    setIsUpdating(true);
    setErrorMessage(null);

    try {
      const { data, error } = await supabase
        .from("expenses")
        .update(updatePayload)
        .eq("id", editingExpense.id)
        .select("id, amount, description, category, date")
        .single();

      if (error) {
        throw error;
      }
      if (!data) {
        setErrorMessage(
          "Update ran, but no row came back. Check your SELECT policy on expenses.",
        );
        return;
      }

      const updated = rowToExpense(data as ExpenseRow);
      setExpenses((prev) =>
        prev.map((row) => (row.id === updated.id ? updated : row)),
      );
      setEditingExpense(null);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Could not update expense.",
      );
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault();

    const parsed = Number.parseFloat(amount);
    if (!description.trim() || Number.isNaN(parsed) || parsed <= 0) {
      return;
    }

    const roundedAmount = Math.round(parsed * 100) / 100;
    const trimmedDescription = description.trim();

    setIsSaving(true);
    setErrorMessage(null);

    let expenseDateIso: string;
    try {
      expenseDateIso = toPostgresDateOnly(date);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Invalid expense date.";
      setErrorMessage(msg);
      setIsSaving(false);
      return;
    }

    const insertPayload: InsertPayload = {
      amount: roundedAmount,
      description: trimmedDescription,
      category,
      date: expenseDateIso,
    };

    console.info("[expenses insert] request (before await)", {
      table: "public.expenses",
      insertPayload,
      formFields: {
        amountRaw: amount,
        descriptionLength: trimmedDescription.length,
        category,
        dateRawFromInput: date,
        expenseDateNormalized: expenseDateIso,
      },
    });

    try {
      // Insert then read the row back — SELECT RLS must allow seeing the new row
      const result = await supabase
        .from("expenses")
        .insert(insertPayload)
        .select("id, amount, description, category, date")
        .single();

      const { data, error, status, statusText, count } = result;

      logExpenseInsertPostgrestResponse(
        { status, statusText, data, error, count },
        insertPayload,
      );

      if (error) {
        const parts = [error.message, error.details, error.hint].filter(Boolean);
        setErrorMessage(parts.join(" — ") || "Could not save expense.");
        return;
      }

      if (!data) {
        console.error("[expenses insert] empty data after success flag", {
          status,
          statusText,
          insertPayload,
          hint: "Often RLS: row inserted but SELECT policy hides it from .select().",
        });
        setErrorMessage("Saved, but no data came back from the server.");
        return;
      }

      const newExpense = rowToExpense(data as ExpenseRow);

      // Keep the UI in sync: new expense at the top (same as before)
      setExpenses((prev) => [newExpense, ...prev]);

      setAmount("");
      setDescription("");
      setCategory(CATEGORY_OPTIONS[0]);
      setDate(getTodayIsoDate());
    } catch (err) {
      logExpenseInsertUnexpected(err, insertPayload);
      setErrorMessage(
        err instanceof Error ? err.message : "Could not save expense.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  const sortedForList = useMemo(() => {
    return [...expenses].sort((a, b) => b.date.localeCompare(a.date));
  }, [expenses]);

  function openEditModal(item: Expense) {
    setErrorMessage(null);
    setEditingExpense(item);
    setEditAmount(String(item.amount));
    setEditDescription(item.description);
    setEditCategory(item.category);
    setEditDate(item.date);
  }

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 border-b border-border pb-8">
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            AI Expense Tracker
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Log spending, spot patterns, and stay on budget. Expenses load from
            and save to your Supabase project.
          </p>
        </header>

        {errorMessage ? (
          <p
            className="mb-6 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {errorMessage}
          </p>
        ) : null}

        <section
          aria-label="Summary"
          className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <SummaryCard
            title="Total spent"
            value={currency.format(totalSpent)}
            hint="Sum of all listed expenses (INR)"
            icon={IndianRupee}
          />
          <SummaryCard
            title="Biggest category"
            value={topCategory}
            hint="Category with the highest total spend"
            icon={PieChartIcon}
          />
          <SummaryCard
            title="Number of expenses"
            value={String(expenseCount)}
            hint="Entries in your current list"
            icon={ReceiptIndianRupee}
          />
        </section>

        <ExpenseCharts expenses={expenses} />

        <div className="grid gap-8 lg:grid-cols-5 lg:items-start">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Add expense</CardTitle>
              <CardDescription>
                Submit the form to save to Supabase and clear these fields for
                the next entry.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddExpense} className="space-y-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="amount"
                    className="flex items-center gap-1.5 text-sm font-medium"
                  >
                    <IndianRupee
                      className="size-3.5 text-muted-foreground"
                      aria-hidden
                    />
                    Amount (INR)
                  </label>
                  <Input
                    id="amount"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    placeholder="e.g. 500"
                    value={amount}
                    onChange={(ev) => setAmount(ev.target.value)}
                    className="h-10"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="description" className="text-sm font-medium">
                    Description
                  </label>
                  <Input
                    id="description"
                    type="text"
                    placeholder="What did you pay for?"
                    value={description}
                    onChange={(ev) => setDescription(ev.target.value)}
                    className="h-10"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="category" className="text-sm font-medium">
                    Category
                  </label>
                  <select
                    id="category"
                    value={category}
                    onChange={(ev) => setCategory(ev.target.value)}
                    className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                  >
                    {CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="date" className="text-sm font-medium">
                    Date
                  </label>
                  <Input
                    id="date"
                    type="date"
                    value={date}
                    onChange={(ev) => setDate(ev.target.value)}
                    className="h-10"
                  />
                </div>

                <Button
                  type="submit"
                  className="mt-2 w-full h-10"
                  size="lg"
                  disabled={isSaving || isUpdating}
                >
                  {isSaving ? "Saving…" : "Add Expense"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-lg">Recent expenses</CardTitle>
              <CardDescription>
                Newest dates first. Each row shows what you spent and how it was
                categorized.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingList ? (
                <p className="text-sm text-muted-foreground">
                  Loading expenses from Supabase…
                </p>
              ) : sortedForList.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No expenses yet. Add one using the form.
                </p>
              ) : (
                <ul className="divide-y divide-border rounded-xl border border-border">
                  {sortedForList.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-col gap-3 p-4 first:rounded-t-xl last:rounded-b-xl sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="truncate font-medium">
                          {item.description}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatDisplayDate(item.date)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                        <Badge variant="secondary">{item.category}</Badge>
                        <span className="text-base font-semibold tabular-nums">
                          {currency.format(item.amount)}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground hover:bg-muted hover:text-foreground"
                          aria-label={`Edit expense: ${item.description}`}
                          disabled={deletingId !== null || isUpdating}
                          onClick={() => openEditModal(item)}
                        >
                          <Pencil className="size-4" aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          aria-label={`Delete expense: ${item.description}`}
                          aria-busy={deletingId === item.id}
                          disabled={deletingId !== null || isUpdating}
                          onClick={() => void handleDeleteExpense(item.id)}
                        >
                          {deletingId === item.id ? (
                            <Loader2
                              className="size-4 animate-spin"
                              aria-hidden
                            />
                          ) : (
                            <Trash2 className="size-4" aria-hidden />
                          )}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {editingExpense ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-expense-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-background/85 backdrop-blur-sm"
            aria-label="Close edit"
            disabled={isUpdating}
            onClick={() => {
              if (!isUpdating) setEditingExpense(null);
            }}
          />
          <Card className="relative z-10 w-full max-w-md shadow-xl ring-1 ring-border">
            <CardHeader>
              <CardTitle id="edit-expense-title" className="text-lg">
                Edit expense
              </CardTitle>
              <CardDescription>
                Update fields and save to Supabase.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateExpense} className="space-y-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="edit-amount"
                    className="flex items-center gap-1.5 text-sm font-medium"
                  >
                    <IndianRupee
                      className="size-3.5 text-muted-foreground"
                      aria-hidden
                    />
                    Amount (INR)
                  </label>
                  <Input
                    id="edit-amount"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={editAmount}
                    onChange={(ev) => setEditAmount(ev.target.value)}
                    className="h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor="edit-description"
                    className="text-sm font-medium"
                  >
                    Description
                  </label>
                  <Input
                    id="edit-description"
                    type="text"
                    value={editDescription}
                    onChange={(ev) => setEditDescription(ev.target.value)}
                    className="h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor="edit-category"
                    className="text-sm font-medium"
                  >
                    Category
                  </label>
                  <select
                    id="edit-category"
                    value={editCategory}
                    onChange={(ev) => setEditCategory(ev.target.value)}
                    className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                  >
                    {CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="edit-date" className="text-sm font-medium">
                    Date
                  </label>
                  <Input
                    id="edit-date"
                    type="date"
                    value={editDate}
                    onChange={(ev) => setEditDate(ev.target.value)}
                    className="h-10"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    disabled={isUpdating}
                    onClick={() => {
                      if (!isUpdating) setEditingExpense(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1" disabled={isUpdating}>
                    {isUpdating ? "Saving…" : "Save changes"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
