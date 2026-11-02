import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../errors';

// unknown urls, e.g. /api/nope
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` },
  });
}

// every failed request ends here, so all errors reach the client in the same format
// express spots error handlers by their 4 arguments, so `next` has to stay even though it's unused
export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  // errors we threw on purpose, e.g. a rule saying no
  if (error instanceof ApiError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }

  // bad input caught by zod, list which fields were wrong
  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'The request is invalid',
        details: error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
    return;
  }

  // express's json parser reports things like broken json with a 4xx status
  const status = (error as { status?: number }).status;
  if (status !== undefined && status >= 400 && status < 500) {
    res.status(status).json({
      error: { code: 'BAD_REQUEST', message: 'The request body could not be read' },
    });
    return;
  }

  // anything else is a bug, log the details here and keep them away from the client
  console.error(error);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
}
