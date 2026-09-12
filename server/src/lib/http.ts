import type { Request, Response, NextFunction, RequestHandler } from 'express';

/** Uniform response envelope — the client never has to guess the shape. */
export function ok<T>(res: Response, data: T, status = 200) {
  return res.status(status).json({ ok: true, data });
}

export function fail(res: Response, status: number, error: string, code = 'error', fields?: Record<string, string>) {
  return res.status(status).json({ ok: false, error, code, ...(fields ? { fields } : {}) });
}

export class HttpError extends Error {
  status: number;
  code: string;
  fields?: Record<string, string>;

  constructor(status: number, message: string, code = 'error', fields?: Record<string, string>) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export const badRequest = (m = 'Invalid request.', fields?: Record<string, string>) =>
  new HttpError(400, m, 'bad_request', fields);
export const unauthorized = (m = 'You need to sign in to continue.') => new HttpError(401, m, 'unauthorized');
export const forbidden = (m = "You don't have access to this.") => new HttpError(403, m, 'forbidden');
export const notFound = (m = 'Not found.') => new HttpError(404, m, 'not_found');
export const conflict = (m = 'That already exists.') => new HttpError(409, m, 'conflict');
export const tooMany = (m = 'Too many requests. Please slow down.') => new HttpError(429, m, 'rate_limited');

/** Wraps async handlers so rejected promises reach the error middleware. */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => {
    void fn(req, res, next).catch(next);
  };
}

/** Turns Zod issues into `{ field: message }` for inline form errors. */
export function fieldErrors(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    fields[key] = issue.message;
  }
  return fields;
}
