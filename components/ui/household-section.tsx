// Target path in your repo: components/ui/household-section.tsx (NEW FILE)
//
// UI for managing the current household: shows the name, members, and
// lets users generate invite codes to share or redeem a code to join
// another household.

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Check, Users, Plus, Loader2, AlertCircle } from 'lucide-react';
import { generateInviteCode, redeemInviteCode } from '@/app/actions/households';
import { cn } from '@/lib/utils/cn';

interface Member {
  user_id: string;
  role: string;
  joined_at: string;
}

interface HouseholdSectionProps {
  household: { id: string; name: string } | null;
  members: Member[];
  currentUserId: string;
}

export function HouseholdSection({ household, members, currentUserId }: HouseholdSectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinSuccess, setJoinSuccess] = useState<string | null>(null);

  async function handleGenerate() {
    startTransition(async () => {
      const result = await generateInviteCode();
      if (result.error) {
        setInviteCode(null);
        return;
      }
      setInviteCode(result.code ?? null);
      setCopied(false);
    });
  }

  async function handleCopy() {
    if (!inviteCode) return;
    await navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleJoin() {
    setJoinError(null);
    setJoinSuccess(null);
    startTransition(async () => {
      const result = await redeemInviteCode(joinCode);
      if (result.error) {
        setJoinError(result.error);
        return;
      }
      setJoinSuccess(`Joined ${result.householdName}!`);
      setJoinCode('');
      // Give the user a moment to see the success message, then refresh
      setTimeout(() => {
        router.refresh();
        setShowJoin(false);
        setJoinSuccess(null);
      }, 1500);
    });
  }

  if (!household) {
    return (
      <div className="card p-5 sm:p-6">
        <p className="label">Household</p>
        <p className="mt-2 text-sm text-muted">
          No household found. Try reloading the page.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-5 sm:p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="label">Household</p>
          <h3 className="mt-1 font-display text-xl text-foreground">{household.name}</h3>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full bg-subtle px-2.5 py-1 text-xs text-muted">
          <Users size={12} strokeWidth={1.75} />
          {members.length} {members.length === 1 ? 'member' : 'members'}
        </div>
      </div>

      {/* Members list */}
      <div className="mt-5 space-y-2">
        {members.map((m) => (
          <div
            key={m.user_id}
            className="flex items-center justify-between text-sm"
          >
            <span className="text-foreground">
              {m.user_id === currentUserId ? 'You' : 'Member'}
              {m.role === 'owner' && (
                <span className="ml-2 text-xs text-faint">owner</span>
              )}
            </span>
            <span className="text-xs text-faint">
              {new Date(m.joined_at).toLocaleDateString()}
            </span>
          </div>
        ))}
      </div>

      {/* Invite flow */}
      <div className="mt-6 border-t border-border pt-5">
        {!inviteCode ? (
          <button
            onClick={handleGenerate}
            disabled={isPending}
            className="btn-outline w-full sm:w-auto"
          >
            {isPending ? (
              <Loader2 size={15} className="animate-spin" strokeWidth={2} />
            ) : (
              <Plus size={15} strokeWidth={2} />
            )}
            Invite someone
          </button>
        ) : (
          <div>
            <p className="label mb-2">Share this code</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg border border-border bg-subtle px-4 py-3 font-mono text-lg tracking-wider text-foreground">
                {inviteCode}
              </code>
              <button
                onClick={handleCopy}
                className="btn-outline shrink-0"
                aria-label="Copy code"
              >
                {copied ? (
                  <Check size={15} strokeWidth={2} />
                ) : (
                  <Copy size={15} strokeWidth={2} />
                )}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="mt-2 text-xs text-muted">
              Send this to someone you want to share your household with. Expires in 7
              days; can only be used once.
            </p>
            <button
              onClick={() => setInviteCode(null)}
              className="mt-3 text-xs text-muted hover:text-foreground"
            >
              Done
            </button>
          </div>
        )}
      </div>

      {/* Join another household */}
      <div className="mt-4 border-t border-border pt-5">
        {!showJoin ? (
          <button
            onClick={() => setShowJoin(true)}
            className="text-sm text-muted hover:text-foreground"
          >
            Have an invite code? Join another household →
          </button>
        ) : (
          <div>
            <p className="label mb-2">Enter invite code</p>
            <div className="flex items-center gap-2">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="XXXX-XXXX-XXX"
                className="input font-mono tracking-wider"
                disabled={isPending}
                maxLength={13}
              />
              <button
                onClick={handleJoin}
                disabled={isPending || !joinCode}
                className="btn-primary shrink-0"
              >
                {isPending && <Loader2 size={15} className="animate-spin" strokeWidth={2} />}
                Join
              </button>
            </div>

            {joinError && (
              <div className="mt-2 flex items-start gap-2 rounded-lg border border-negative/30 bg-negative/5 p-3 text-xs text-negative">
                <AlertCircle size={14} strokeWidth={1.75} className="mt-0.5 shrink-0" />
                <span>{joinError}</span>
              </div>
            )}

            {joinSuccess && (
              <div className="mt-2 flex items-start gap-2 rounded-lg border border-positive/30 bg-positive/5 p-3 text-xs text-positive">
                <Check size={14} strokeWidth={1.75} className="mt-0.5 shrink-0" />
                <span>{joinSuccess}</span>
              </div>
            )}

            <button
              onClick={() => {
                setShowJoin(false);
                setJoinCode('');
                setJoinError(null);
              }}
              className="mt-3 text-xs text-muted hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
