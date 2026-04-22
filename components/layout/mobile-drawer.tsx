'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X, LogOut } from 'lucide-react';
import { navItems } from './nav-items';
import { ThemeToggle } from '@/components/theme-toggle';
import { signOut } from '@/app/auth/actions';
import { cn } from '@/lib/utils/cn';

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function MobileDrawer({ open, onClose }: MobileDrawerProps) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  // Close the drawer when the route changes (after a nav link click)
  useEffect(() => {
    if (open) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!open || !mounted) return null;

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Navigation"
      className="fixed inset-0 z-50 lg:hidden"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-foreground/30 backdrop-blur-[2px] animate-[fadeIn_0.15s_ease-out]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel (slides in from the right) */}
      <aside
        className={cn(
          'absolute inset-y-0 right-0 flex w-[85%] max-w-sm flex-col',
          'bg-elevated border-l border-border shadow-elevated',
          'animate-[slideInRight_0.22s_cubic-bezier(0.16,1,0.3,1)]'
        )}
      >
        {/* Header */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <Link href="/dashboard" onClick={onClose} className="flex items-baseline">
            <span className="font-display text-xl font-medium tracking-tight text-foreground">
              Tally
            </span>
            <span className="font-display text-xl font-medium text-accent" aria-hidden>
              .
            </span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-subtle hover:text-foreground"
            aria-label="Close menu"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-0.5">
            {navItems.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(item.href + '/');
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
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
                    <Icon size={16} strokeWidth={1.75} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer: theme toggle + sign out */}
        <div className="shrink-0 border-t border-border p-3 space-y-1">
          <div className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-muted">
            <span>Appearance</span>
            <ThemeToggle />
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted transition-colors hover:bg-subtle hover:text-foreground"
            >
              <LogOut size={16} strokeWidth={1.75} />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );

  return createPortal(content, document.body);
}
