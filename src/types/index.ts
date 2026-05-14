export type Expense = {
  id: string;
  amount: number;
  description: string;
  category: string;
  /** YYYY-MM-DD */
  date: string;
};

/** Raw row shape returned by Supabase / PostgREST */
export type ExpenseRow = {
  id: string;
  amount: number | string;
  description: string;
  category: string;
  date: string;
};

export const CATEGORY_OPTIONS = [
  "Food",
  "Petrol",
  "Rent",
  "UPI Payments",
  "Shopping",
  "Travel",
  "Recharge",
] as const;

export type Category = (typeof CATEGORY_OPTIONS)[number];
