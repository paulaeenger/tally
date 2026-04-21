import { Sidebar } from '@/components/layout/sidebar';
import { MobileNav } from '@/components/layout/mobile-nav';
import { MobileTopBar } from '@/components/layout/mobile-top-bar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-dvh">
      <Sidebar />
      <MobileTopBar />
      <main className="relative z-10 pb-24 lg:ml-60 lg:pb-0">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          {children}
        </div>
      </main>
      <MobileNav />
    </div>
  );
}
