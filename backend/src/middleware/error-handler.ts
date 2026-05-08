import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error('Unhandled error:', err.message);
  console.error(err.stack);

  const statusCode = (err as any).statusCode || 500;
  res.status(statusCode).json({
    error: {
      message: statusCode === 500 ? 'Internal server error' : err.message,
    },
  });
}

export class AppError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
  }
}
