"use client";

import { LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/AuthProvider";

export function Navbar() {
  const { user, signOut } = useAuth();

  return (
    <nav className="border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-40">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <span className="font-semibold tracking-tight">AI Expense Tracker</span>

        {user && (
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 text-sm text-muted-foreground sm:flex">
              <User className="size-3.5" aria-hidden />
              {user.email}
            </span>
            <Button variant="ghost" size="sm" onClick={() => void signOut()}
              className="gap-1.5 text-muted-foreground hover:text-foreground">
              <LogOut className="size-4" aria-hidden />
              Sign out
            </Button>
          </div>
        )}
      </div>
    </nav>
  );
}
