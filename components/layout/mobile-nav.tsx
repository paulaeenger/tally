'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { navItems } from './nav-items';
import { cn } from '@/lib/utils/cn';

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface shadow-[0_-2px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_-2px_8px_rgba(0,0,0,0.4)] lg:hidden">
      <div className="grid grid-cols-6 pb-[env(safe-area-inset-bottom)]">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors',
                active ? 'text-foreground' : 'text-faint hover:text-muted'
              )}
            >
              <div className="relative flex h-6 w-6 items-center justify-center">
                {active && (
                  <span
                    className="absolute -top-2.5 h-0.5 w-6 rounded-full bg-accent"
                    aria-hidden
                  />
                )}
                <Icon size={18} strokeWidth={active ? 2 : 1.5} />
              </div>
              <span className="tracking-wide">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
