/**
 * Human-readable API failure text from status + body (JSON `error` / `message` or raw text).
 */
export function formatApiErrorText(status: number, bodyText: string): string {
  const trimmed = bodyText.trim();
  if (trimmed.startsWith("{")) {
    try {
      const j = JSON.parse(trimmed) as {
        error?: string;
        message?: string;
        detail?: string;
      };
      const part = j.error ?? j.message ?? j.detail;
      if (typeof part === "string" && part.length > 0) {
        return `HTTP ${status}: ${part}`;
      }
    } catch {
      /* use raw */
    }
  }
  const short = trimmed.length > 400 ? `${trimmed.slice(0, 400)}…` : trimmed;
  if (short) return `HTTP ${status}: ${short}`;
  if (status === 401) return "HTTP 401: Unauthorized";
  if (status === 403) return "HTTP 403: Forbidden";
  if (status === 404) return "HTTP 404: Not found";
  return `HTTP ${status}`;
}

/** Use after fetch(): reads the body once, returns data or an error string. */
export async function readApiJson<T>(
  res: Response,
): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  const text = await res.text();
  if (!res.ok) {
    return { ok: false, message: formatApiErrorText(res.status, text) };
  }
  try {
    return { ok: true, data: JSON.parse(text) as T };
  } catch {
    return {
      ok: false,
      message: `HTTP ${res.status}: response was not valid JSON`,
    };
  }
}

/**
 * fetch + readApiJson with network failure handling (offline API, wrong host, DNS).
 */
export async function fetchApiJson<T>(
  url: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  try {
    const res = await fetch(url, init);
    return readApiJson<T>(res);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    const base =
      typeof url === "string" && url.includes("/v1/")
        ? url.split("/v1/")[0]
        : url;
    return {
      ok: false,
      message: `Could not reach API (${base}): ${detail}. Start apps/api or set NEXT_PUBLIC_API_URL / INTERNAL_API_URL.`,
    };
  }
}
