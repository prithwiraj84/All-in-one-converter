"use client";

import { API_BASE } from "./api";
import { createClient } from "@/lib/supabase/client";

/** Business-plan APIs (REST API keys + Team workspaces). All calls authenticate
 * with the signed-in user's Supabase session token. */

async function sessionToken(): Promise<string | null> {
  try {
    const { data } = await createClient().auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

async function authFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await sessionToken();
  return fetch(`${API_BASE}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

async function detail(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: string };
    return body.detail || fallback;
  } catch {
    return fallback;
  }
}

/* ── REST API keys ──────────────────────────────────────────────── */
export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  created_at: string;
}
export interface NewApiKey extends ApiKey {
  key: string; // full secret — returned only once
}

export async function listApiKeys(): Promise<ApiKey[]> {
  const res = await authFetch("/api/keys");
  if (!res.ok) throw new Error(await detail(res, "Couldn't load your API keys."));
  return (await res.json()).keys as ApiKey[];
}

export async function createApiKey(name: string): Promise<NewApiKey> {
  const res = await authFetch("/api/keys", { method: "POST", body: JSON.stringify({ name }) });
  if (!res.ok) throw new Error(await detail(res, "Couldn't create the key."));
  return res.json();
}

export async function revokeApiKey(id: string): Promise<void> {
  const res = await authFetch(`/api/keys/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await detail(res, "Couldn't revoke the key."));
}

/* ── Team workspaces ────────────────────────────────────────────── */
export type TeamRole = "owner" | "admin" | "member";

export interface TeamMember {
  id: string;
  email: string;
  role: TeamRole;
  status: string; // "invited" | "active"
  created_at: string;
}
export interface Team {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
}
export interface Membership {
  team_id: string;
  team_name: string;
  role: TeamRole | null;
  status: string | null;
}
export interface TeamState {
  owned: { team: Team; members: TeamMember[] } | null;
  memberships: Membership[];
  is_business_owner: boolean;
}

export async function getTeam(): Promise<TeamState> {
  const res = await authFetch("/api/teams/me");
  if (!res.ok) throw new Error(await detail(res, "Couldn't load your team."));
  return res.json();
}

export async function renameTeam(name: string): Promise<void> {
  const res = await authFetch("/api/teams/me", { method: "PATCH", body: JSON.stringify({ name }) });
  if (!res.ok) throw new Error(await detail(res, "Couldn't rename the team."));
}

export async function addMember(email: string, role: TeamRole): Promise<void> {
  const res = await authFetch("/api/teams/members", {
    method: "POST",
    body: JSON.stringify({ email, role }),
  });
  if (!res.ok) throw new Error(await detail(res, "Couldn't add the member."));
}

export async function setMemberRole(id: string, role: TeamRole): Promise<void> {
  const res = await authFetch(`/api/teams/members/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
  if (!res.ok) throw new Error(await detail(res, "Couldn't update the role."));
}

export async function removeMember(id: string): Promise<void> {
  const res = await authFetch(`/api/teams/members/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await detail(res, "Couldn't remove the member."));
}
