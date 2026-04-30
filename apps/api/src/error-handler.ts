import type { NextFunction, Request, Response } from "express";

function getStatus(err: unknown): number {
  if (typeof err === "object" && err !== null && "statusCode" in err) {
    const n = Number((err as { statusCode: unknown }).statusCode);
    if (Number.isFinite(n) && n >= 400 && n < 600) return n;
  }
  if (typeof err === "object" && err !== null && "status" in err) {
    const n = Number((err as { status: unknown }).status);
    if (Number.isFinite(n) && n >= 400 && n < 600) return n;
  }
  return 500;
}

function getMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/** Last middleware: JSON errors for API clients + full logs in development. */
export function apiErrorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (res.headersSent) {
    next(err);
    return;
  }

  const status = getStatus(err);
  const message = getMessage(err);
  const isDev = process.env.NODE_ENV !== "production";

  console.error(`[api] ${req.method} ${req.path} → ${status}`, message);
  if (isDev && err instanceof Error && err.stack) {
    console.error(err.stack);
  }

  const body: Record<string, unknown> = { error: message };
  if (isDev) {
    body.path = req.path;
    if (err instanceof Error && err.stack) body.stack = err.stack;
  }

  res.status(status).json(body);
}
