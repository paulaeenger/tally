'use client';

import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';

export function MobileTopBar() {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-surface/90 px-4 backdrop-blur-xl lg:hidden">
      <Link href="/dashboard" className="flex items-baseline">
        <span className="font-display text-xl font-medium tracking-tight text-foreground">
          Tally
        </span>
        <span className="font-display text-xl font-medium text-accent" aria-hidden>
          .
        </span>
      </Link>
      <ThemeToggle />
    </header>
  );
}
