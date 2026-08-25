/**
 * Auth's public surface. `revokeAllSessions` is here because Users needs to
 * end a session it must not reach into the refresh-token table to end.
 */
export * from './auth.module';
export * from './auth.service';
