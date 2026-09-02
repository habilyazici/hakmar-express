/**
 * An unknown thrown value rendered for a log line.
 *
 * `catch` binds `unknown`, so every place that logs a failure has to narrow
 * it first, and three of them had each written their own version of the same
 * ternary. A rejected promise is not always an Error — a driver can reject
 * with a string, and `String(err)` on a plain object gives the useless
 * "[object Object]" — so the shape of that narrowing is worth having in one
 * place rather than four.
 */
export function errorText(err: unknown): string {
  if (err instanceof Error) return err.stack ?? err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    // Circular references, mostly.
    return String(err);
  }
}
