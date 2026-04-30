import type { NextFunction, Request, RequestHandler, Response } from "express";

/** Routes rejected promises to Express `next` so errors surface correctly. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    void Promise.resolve(fn(req, res, next)).catch(next);
  };
}
