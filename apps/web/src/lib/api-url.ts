/**
 * Backend API base URL (no DB in the web app; all data via HTTP).
 * Browser: set NEXT_PUBLIC_API_URL. Server-side fetch: INTERNAL_API_URL or same default.
 */
export function getApiUrl(): string {
  if (typeof window !== "undefined") {
    return process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000";
  }
  return (
    process.env.INTERNAL_API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://127.0.0.1:4000"
  );
}
