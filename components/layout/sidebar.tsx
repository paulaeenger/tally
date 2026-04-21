'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { navItems } from './nav-items';
import { cn } from '@/lib/utils/cn';
import { ThemeToggle } from '@/components/theme-toggle';

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-surface lg:flex">
      {/* Brand */}
      <div className="flex h-16 items-center border-b border-border px-6">
        <Link href="/dashboard" className="group flex items-baseline">
          <span className="font-display text-2xl font-medium tracking-tight text-foreground">
            Tally
          </span>
          <span
            className="font-display text-2xl font-medium text-accent transition-opacity group-hover:opacity-60"
            aria-hidden
          >
            .
          </span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-3">
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                    active
                      ? 'bg-subtle text-foreground font-medium'
                      : 'text-muted hover:bg-subtle hover:text-foreground'
                  )}
                >
                  {active && (
                    <span
                      className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-accent"
                      aria-hidden
                    />
                  )}
                  <Icon
                    size={17}
                    strokeWidth={active ? 2 : 1.5}
                    className={active ? 'text-accent' : ''}
                  />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border p-4">
        <span className="text-xs text-faint">v0.1</span>
        <ThemeToggle />
      </div>
    </aside>
  );
}
