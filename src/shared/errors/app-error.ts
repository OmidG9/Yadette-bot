/**
 * Application error taxonomy.
 *
 * Every error that reaches the Telegram layer must be an `AppError` (or be
 * wrapped into one) so we can show a friendly message while keeping the real
 * cause in the logs only.
 */
export class AppError extends Error {
  readonly isAppError = true;

  constructor(
    message: string,
    readonly options: {
      code: string;
      cause?: unknown;
      /** Extra structured context for logs. Never shown to users. */
      context?: Record<string, unknown>;
    },
  ) {
    super(message, { cause: options.cause });
    this.name = new.target.name;
  }

  /** Stable, non-sensitive identifier used to pick the message a user sees. */
  get code(): string {
    return this.options.code;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, { code: 'VALIDATION_ERROR', context });
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, context?: Record<string, unknown>) {
    super(`${resource} not found`, { code: 'NOT_FOUND', context });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access denied', context?: Record<string, unknown>) {
    super(message, { code: 'FORBIDDEN', context });
  }
}

export class ConflictError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, { code: 'CONFLICT', context });
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/** Normalizes anything thrown into an `Error` for logging purposes. */
export function toError(error: unknown): Error {
  if (error instanceof Error) return error;
  return new Error(typeof error === 'string' ? error : 'Unknown error');
}
