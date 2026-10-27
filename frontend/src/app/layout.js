import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ToastProvider } from "@/components/providers/toast-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/layout/app-shell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: {
    default: "PatchPilot — AI code reviews for GitHub",
    template: "%s · PatchPilot",
  },
  description:
    "PatchPilot reviews GitHub pull requests, surfaces bugs and security issues, and suggests fixes before you merge.",
};

const themeScript = `
try {
  var stored = localStorage.getItem('patchpilot-theme');
  var dark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark', dark);
} catch (_) {}
`;

function ShellFallback() {
  return (
    <div className="min-h-screen bg-background" aria-busy="true" aria-label="Loading PatchPilot">
      <div className="mx-auto flex min-h-screen max-w-[1440px] items-center justify-center px-6">
        <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
          <span className="size-8 animate-pulse rounded-lg bg-primary/20" />
          Loading PatchPilot…
        </div>
      </div>
    </div>
  );
}

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full bg-background text-foreground">
        <ThemeProvider>
          <ToastProvider>
            <TooltipProvider>
              <Suspense fallback={<ShellFallback />}>
                <AppShell>{children}</AppShell>
              </Suspense>
            </TooltipProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}