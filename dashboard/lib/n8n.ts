/* Shared n8n REST helper for the platform-admin pages.

   Why this exists: each page used to build its own URL as
   `process.env.N8N_BASE_URL ?? "https://…/api/v1"` — but the env var is set to the
   bare host (no `/api/v1`), so the request went to `https://host/workflows`, which
   n8n answers with the EDITOR HTML page and a 200. `.json()` then threw, the catch
   swallowed it, and the UI blamed a missing API key. Normalising the base in one
   place fixes all three pages and prevents the trap from coming back. */

const DEFAULT_HOST = "https://n8n.srv1239666.hstgr.cloud";

/** Always returns a base ending in `/api/v1`, whether the env var includes it or not. */
export function n8nApiBase(): string {
  const raw = (process.env.N8N_BASE_URL ?? DEFAULT_HOST).trim().replace(/\/+$/, "");
  return /\/api\/v\d+$/.test(raw) ? raw : `${raw}/api/v1`;
}

export type N8nFetchResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "no_key" | "unreachable" | "unauthorized" | "bad_response" };

/** GET an n8n REST path (e.g. "workflows?limit=100") with the API key.
    Distinguishes a missing key from a real connection/auth failure so the UI can
    say which one actually happened. */
export async function n8nGet<T>(path: string, timeoutMs = 5000): Promise<N8nFetchResult<T>> {
  const key = process.env.N8N_API_KEY;
  if (!key) return { ok: false, reason: "no_key" };

  try {
    const res = await fetch(`${n8nApiBase()}/${path.replace(/^\/+/, "")}`, {
      headers: { "X-N8N-API-KEY": key, Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (res.status === 401 || res.status === 403) return { ok: false, reason: "unauthorized" };
    if (!res.ok) return { ok: false, reason: "bad_response" };
    // guard against n8n serving the editor HTML on a wrong path
    if (!(res.headers.get("content-type") ?? "").includes("application/json")) {
      return { ok: false, reason: "bad_response" };
    }
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, reason: "unreachable" };
  }
}

/** POST an n8n REST path — used to activate/deactivate a workflow.

    Same failure taxonomy as n8nGet, including the content-type guard: n8n
    answers an unknown path with the editor's HTML and a 200, so "it worked"
    cannot be inferred from the status code alone. */
export async function n8nPost<T>(path: string, timeoutMs = 8000): Promise<N8nFetchResult<T>> {
  const key = process.env.N8N_API_KEY;
  if (!key) return { ok: false, reason: "no_key" };

  try {
    const res = await fetch(`${n8nApiBase()}/${path.replace(/^\/+/, "")}`, {
      method: "POST",
      headers: { "X-N8N-API-KEY": key, Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (res.status === 401 || res.status === 403) return { ok: false, reason: "unauthorized" };
    if (!res.ok) return { ok: false, reason: "bad_response" };
    if (!(res.headers.get("content-type") ?? "").includes("application/json")) {
      return { ok: false, reason: "bad_response" };
    }
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, reason: "unreachable" };
  }
}

/** Arabic message for each failure mode — so the founder sees the real cause. */
export function n8nErrorMessage(reason: "no_key" | "unreachable" | "unauthorized" | "bad_response"): string {
  switch (reason) {
    case "no_key":
      return "مفتاح n8n غير مضبوط على الخادم — أضف N8N_API_KEY في Vercel (الأتمتة نفسها تعمل)";
    case "unauthorized":
      return "مفتاح n8n مرفوض (منتهي أو مُبطَّل) — أنشئ مفتاحاً جديداً من n8n وحدّثه في Vercel";
    case "unreachable":
      return "تعذّر الوصول إلى خادم n8n — تحقق من أنه يعمل";
    default:
      return "استجابة غير متوقعة من n8n — تحقق من N8N_BASE_URL في Vercel";
  }
}
