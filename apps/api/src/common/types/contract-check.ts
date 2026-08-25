/**
 * Compile-time proof that a TypeScript enum in this codebase and the string
 * union the web consumes from @hakmar/contracts describe the same set.
 *
 * Needed because TypeScript's string enums are nominal: `'sales'` is not
 * assignable to `SalesMetric.SALES`, so the two cannot simply be compared
 * with `extends` in both directions. Widening the enum to its literal values
 * first makes an honest two-way comparison possible.
 *
 *   export type _Check = Assert<SameMembers<ValuesOf<MyEnum>, MyUnion>>;
 *
 * Add a member to one side only and the build fails, naming the member that
 * is missing and which side is missing it.
 */

/** The literal strings behind a string enum. */
export type ValuesOf<E extends string> = `${E}`;

export type SameMembers<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? true
    : { theApiIsMissing: Exclude<B, A> }
  : { theContractIsMissing: Exclude<A, B> };

/** Fails to compile, naming the offending member, unless T is `true`. */
export type Assert<T extends true> = T;
