import { User, Palette, Bell, Shield, LogOut } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { ThemeToggle } from '@/components/theme-toggle';
import { getProfile } from '@/lib/data/queries';
import { signOut } from '@/app/auth/actions';

export default async function SettingsPage() {
  const profile = await getProfile();

  return (
    <div className="stagger space-y-6">
      <PageHeader
        eyebrow="Preferences"
        title="Settings"
        description="Make this feel like yours."
      />

      {/* Profile */}
      <section className="card p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-subtle font-display text-xl text-foreground">
            {(profile?.full_name?.[0] ?? 'D').toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl text-foreground">
              {profile?.full_name || 'Demo User'}
            </h2>
            <p className="text-sm text-muted">Default currency · {profile?.currency ?? 'USD'}</p>
          </div>
          <button className="btn-outline hidden sm:inline-flex">Edit profile</button>
        </div>
      </section>

      {/* Settings groups */}
      <section className="card divide-y divide-border overflow-hidden">
        <SettingRow
          icon={Palette}
          label="Appearance"
          description="Switch between light and dark"
          action={<ThemeToggle />}
        />
        <SettingRow
          icon={User}
          label="Account details"
          description="Name, email, and currency"
          action={<button className="btn-ghost text-xs">Manage</button>}
        />
        <SettingRow
          icon={Bell}
          label="Notifications"
          description="Budget alerts and weekly summaries"
          action={<button className="btn-ghost text-xs">Configure</button>}
        />
        <SettingRow
          icon={Shield}
          label="Privacy & security"
          description="Password, two-factor, sessions"
          action={<button className="btn-ghost text-xs">Review</button>}
        />
      </section>

      {/* Danger zone */}
      <section className="card p-6">
        <h3 className="label">Session</h3>
        <form action={signOut} className="mt-3">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg border border-negative/30 bg-negative/5 px-4 py-2 text-sm font-medium text-negative transition-colors hover:bg-negative/10"
          >
            <LogOut size={15} strokeWidth={1.75} />
            Sign out
          </button>
        </form>
      </section>

      <p className="pt-4 text-center text-xs text-faint">
        Tally · v0.1 · Built with Next.js & Supabase
      </p>
    </div>
  );
}

function SettingRow({
  icon: Icon,
  label,
  description,
  action,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
      <div className="flex items-start gap-3 min-w-0">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-subtle text-muted">
          <Icon size={15} strokeWidth={1.5} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted">{description}</p>
        </div>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}
