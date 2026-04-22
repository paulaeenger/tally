'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { MobileDrawer } from './mobile-drawer';

export function MobileTopBar() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-surface/90 px-4 backdrop-blur-xl lg:hidden">
        <Link href="/dashboard" className="flex items-baseline">
          <span className="font-display text-xl font-medium tracking-tight text-foreground">
            Tally
          </span>
          <span className="font-display text-xl font-medium text-accent" aria-hidden>
            .
          </span>
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-muted transition-colors hover:bg-subtle hover:text-foreground"
            aria-label="Open menu"
          >
            <Menu size={18} strokeWidth={1.75} />
          </button>
        </div>
      </header>
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
