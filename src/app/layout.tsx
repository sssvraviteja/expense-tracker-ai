import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/providers/AuthProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Expense Tracker",
  description: "Track expenses with AI-powered insights",
};

/**
 * Root layout wraps every page with AuthProvider.
 *
 * WHY HERE?
 * AuthProvider is a React context. Any component below this layout can call
 * useAuth() to access the current user. Placing it at the root means:
 * - All pages (dashboard, auth pages, future pages) share the same auth state
 * - We only set up the onAuthStateChange listener once
 * - The user object is always fresh without extra fetches per page
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
