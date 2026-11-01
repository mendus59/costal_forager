// Shared helpers for the sync edge functions (Deno).
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.45.4";

export function serviceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Only callers holding the service role key (pg_cron, admins) may run syncs. */
export function authorized(req: Request): boolean {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  return !!key && req.headers.get("Authorization") === `Bearer ${key}`;
}

const USER_AGENT = "costal_forager/0.1 (Washington shellfish app; https://github.com/mendus59/costal_forager)";

export async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

export async function getText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "text/html" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

/** Run a job, record it in sync_runs, and answer with its result as JSON. */
export async function runJob(
  req: Request,
  job: string,
  fn: (db: SupabaseClient) => Promise<Record<string, unknown>>,
): Promise<Response> {
  if (!authorized(req)) return new Response("Unauthorized", { status: 401 });
  const db = serviceClient();
  const { data: run } = await db.from("sync_runs").insert({ job }).select("id").single();
  try {
    const detail = await fn(db);
    await db.from("sync_runs").update({ finished_at: new Date().toISOString(), ok: true, detail }).eq("id", run?.id);
    return Response.json({ ok: true, ...detail });
  } catch (err) {
    const detail = { error: String(err) };
    await db.from("sync_runs").update({ finished_at: new Date().toISOString(), ok: false, detail }).eq("id", run?.id);
    return Response.json({ ok: false, ...detail }, { status: 500 });
  }
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Throw on a Supabase error so the job is recorded as failed. */
export function must<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
