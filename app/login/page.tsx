import Link from 'next/link';
import { signIn, signUp } from '@/app/auth/actions';
import { ThemeToggle } from '@/components/theme-toggle';
import { isSupabaseConfigured } from '@/lib/data/queries';

export default function LoginPage({
  searchParams,
}: {
  searchParams: { mode?: string; error?: string; message?: string };
}) {
  const isSignUp = searchParams.mode === 'signup';
  const configured = isSupabaseConfigured();

  return (
    <div className="relative min-h-dvh">
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
        {/* Brand */}
        <div className="mb-10 text-center">
          <div className="mb-3 flex items-baseline justify-center">
            <span className="font-display text-3xl font-medium tracking-tight text-foreground">
              Tally
            </span>
            <span className="font-display text-3xl font-medium text-accent" aria-hidden>
              .
            </span>
          </div>
          <p className="font-display text-sm italic text-muted">
            A considered approach to your money.
          </p>
        </div>

        <div className="card p-6 sm:p-8">
          <h1 className="font-display text-2xl text-foreground">
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {isSignUp ? 'Start tracking in a minute.' : 'Sign in to continue.'}
          </p>

          {!configured && (
            <div className="mt-4 rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
              Supabase is not configured yet. You can continue with sample data — add
              credentials in <code className="font-mono">.env.local</code> to enable auth.
            </div>
          )}

          {searchParams.error && (
            <div className="mt-4 rounded-lg border border-negative/30 bg-negative/5 p-3 text-xs text-negative">
              {searchParams.error}
            </div>
          )}

          {searchParams.message && (
            <div className="mt-4 rounded-lg border border-positive/30 bg-positive/5 p-3 text-xs text-positive">
              {searchParams.message}
            </div>
          )}

          <form action={isSignUp ? signUp : signIn} className="mt-6 space-y-4">
            {isSignUp && (
              <div>
                <label htmlFor="full_name" className="label mb-1.5 block">
                  Full name
                </label>
                <input
                  id="full_name"
                  name="full_name"
                  type="text"
                  required
                  autoComplete="name"
                  className="input"
                  placeholder="Jane Doe"
                />
              </div>
            )}
            <div>
              <label htmlFor="email" className="label mb-1.5 block">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="input"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="label mb-1.5 block">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={6}
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                className="input"
                placeholder="••••••••"
              />
            </div>

            <button type="submit" className="btn-primary w-full">
              {isSignUp ? 'Create account' : 'Sign in'}
            </button>

            {!configured && (
              <Link href="/dashboard" className="btn-outline w-full">
                Continue with sample data →
              </Link>
            )}
          </form>

          <div className="mt-6 text-center text-sm text-muted">
            {isSignUp ? (
              <>
                Already have an account?{' '}
                <Link href="/login" className="font-medium text-foreground underline decoration-faint underline-offset-2 hover:decoration-foreground">
                  Sign in
                </Link>
              </>
            ) : (
              <>
                New here?{' '}
                <Link href="/login?mode=signup" className="font-medium text-foreground underline decoration-faint underline-offset-2 hover:decoration-foreground">
                  Create an account
                </Link>
              </>
            )}
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-faint">
          By continuing, you agree to thoughtful data stewardship.
        </p>
      </div>
    </div>
  );
}
