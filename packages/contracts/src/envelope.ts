/** Every successful response is wrapped in this by the API's global interceptor. */
export interface ApiEnvelope<T> {
  success: true;
  data: T;
}

/**
 * Every failed response, shaped by the API's global exception filter.
 *
 * Declared here for the same reason the success envelope is: the web reads
 * `error.message` out of this on every failed request, and it used to do so
 * through a structural type written inline at the one place that reads it —
 * so the two sides agreed only by coincidence.
 */
export interface ApiErrorEnvelope {
  success: false;
  error: {
    /** The HttpStatus name, e.g. "CONFLICT". */
    code: string;
    message: string;
    /**
     * The X-Request-Id this failure was logged under, so a report of "it said
     * something went wrong" can be matched to the stack trace behind it.
     * Present on 5xx only — a validation error already says what was wrong.
     */
    requestId?: string;
  };
}

/** The shape every paginated list endpoint returns. */
export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
