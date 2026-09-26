import type { ApiError, ApiErrorCode } from '@/cloud/contract';

const STATUS: Record<ApiErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  email_taken: 409,
  invalid_credentials: 401,
  weak_password: 400,
  rate_limited: 429,
  plan_limit: 403,
  too_large: 413,
  unsupported_type: 415,
  server_error: 500,
};

/** Thrown by handlers; `onError` turns it into ApiError JSON. */
export class ApiException extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;
  readonly headers?: Record<string, string>;

  constructor(
    code: ApiErrorCode,
    message: string,
    details?: Record<string, unknown>,
    headers?: Record<string, string>,
  ) {
    super(message);
    this.code = code;
    this.status = STATUS[code];
    this.details = details;
    this.headers = headers;
  }

  toJSON(): ApiError {
    return this.details ? { code: this.code, message: this.message, details: this.details } : { code: this.code, message: this.message };
  }
}
