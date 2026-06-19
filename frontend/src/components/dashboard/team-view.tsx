"use client";

import * as React from "react";
import Link from "next/link";
import { Users, UserPlus, Trash2, Loader2, Crown, ShieldCheck, Check, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getTeam,
  renameTeam,
  addMember,
  setMemberRole,
  removeMember,
  type TeamState,
  type TeamRole,
} from "@/lib/business-api";

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";
const selectCls =
  "rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-medium outline-none focus:border-primary";

function RoleBadge({ role }: { role: string }) {
  if (role === "owner")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-brand-gradient px-2 py-0.5 text-[11px] font-semibold text-white">
        <Crown className="h-3 w-3" /> Owner
      </span>
    );
  const c = role === "admin" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${c}`}>{role}</span>;
}

export function TeamView() {
  const [state, setState] = React.useState<TeamState | null>(null);
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<TeamRole>("member");
  const [busy, setBusy] = React.useState(false);
  const [editingName, setEditingName] = React.useState(false);
  const [teamName, setTeamName] = React.useState("");

  const load = React.useCallback(async () => {
    try {
      const s = await getTeam();
      setState(s);
      if (s.owned) setTeamName(s.owned.team.name);
    } catch {
      setState({ owned: null, memberships: [], is_business_owner: false });
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function invite() {
    const e = email.trim().toLowerCase();
    if (!e || !e.includes("@")) {
      toast.error("Enter a valid email.");
      return;
    }
    setBusy(true);
    try {
      await addMember(e, role);
      setEmail("");
      toast.success(`Invitation sent to ${e}`);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(id: string, r: TeamRole) {
    try {
      await setMemberRole(id, r);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function remove(id: string, who: string) {
    if (!window.confirm(`Remove ${who} from the team?`)) return;
    try {
      await removeMember(id);
      toast.success("Member removed");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function saveName() {
    try {
      await renameTeam(teamName.trim() || "My team");
      setEditingName(false);
      toast.success("Team renamed");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  if (state === null) {
    return (
      <div className="flex items-center gap-2 py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading…
      </div>
    );
  }

  // Not a Business owner and not on any team → upsell.
  if (!state.owned && state.memberships.length === 0) {
    return (
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Team</h1>
        <Card className="mt-6 p-8 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-primary" />
          <p className="mt-3 font-semibold">Team workspaces are a Business feature</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Invite your team and give everyone Business access under one plan, with roles you control.
          </p>
          <Button asChild variant="gradient" className="mt-5">
            <Link href="/#pricing">See Business plan</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Team</h1>
        <p className="mt-1.5 text-muted-foreground">
          Members inherit your Business access — bigger files, more storage, no ads.
        </p>
      </div>

      {/* Owner's workspace */}
      {state.owned && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2">
              {editingName ? (
                <>
                  <input
                    className={inputCls + " max-w-[14rem]"}
                    value={teamName}
                    maxLength={60}
                    onChange={(e) => setTeamName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveName()}
                    autoFocus
                  />
                  <Button size="sm" variant="outline" onClick={saveName}>
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                </>
              ) : (
                <>
                  <Users className="h-5 w-5 text-primary" />
                  {state.owned.team.name}
                  <button onClick={() => setEditingName(true)} className="text-muted-foreground hover:text-foreground">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </CardTitle>
            <span className="text-xs text-muted-foreground">{state.owned.members.length} members</span>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Invite */}
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                className={inputCls}
                type="email"
                placeholder="teammate@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && invite()}
              />
              <select className={selectCls} value={role} onChange={(e) => setRole(e.target.value as TeamRole)}>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
              <Button variant="gradient" onClick={invite} disabled={busy} className="shrink-0">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Invite
              </Button>
            </div>

            {/* Members */}
            <ul className="divide-y divide-border rounded-xl border border-border">
              {/* Owner (you) */}
              <li className="flex items-center gap-3 px-3.5 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">You (owner)</p>
                </div>
                <RoleBadge role="owner" />
              </li>
              {state.owned.members.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-3.5 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{m.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.status === "active" ? "Active" : "Invited"}
                    </p>
                  </div>
                  <select
                    className={selectCls}
                    value={m.role}
                    onChange={(e) => changeRole(m.id, e.target.value as TeamRole)}
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => remove(m.id, m.email)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
              {state.owned.members.length === 0 && (
                <li className="px-3.5 py-6 text-center text-sm text-muted-foreground">
                  No members yet — invite a teammate above.
                </li>
              )}
            </ul>
            <p className="text-xs text-muted-foreground">
              Invited people get an email to join, and Business access automatically the next time they sign
              in with that email.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Teams the user belongs to (as a member) */}
      {state.memberships.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Your memberships</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {state.memberships.map((m) => (
                <li key={m.team_id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-secondary/10 text-secondary">
                    <Users className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{m.team_name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{m.role ?? "member"}</p>
                  </div>
                  {m.role && <RoleBadge role={m.role} />}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
