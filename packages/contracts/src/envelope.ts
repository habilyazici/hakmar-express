/** Every successful response is wrapped in this by the API's global interceptor. */
export interface ApiEnvelope<T> {
  success: true;
  data: T;
}

/** The shape every paginated list endpoint returns. */
export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
