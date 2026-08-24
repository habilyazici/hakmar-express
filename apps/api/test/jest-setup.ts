// class-transformer and class-validator read decorator metadata via the
// Reflect API, which only exists once this polyfill is loaded. main.ts pulls
// it in through @nestjs/core, and any spec using Test.createTestingModule got
// it transitively — but a spec that exercises a plain function (env
// validation, the exception filter) does not, and failed with
// "Reflect.getMetadata is not a function". Loading it for every suite keeps
// that from depending on which Nest helper a test happens to touch.
import 'reflect-metadata';
