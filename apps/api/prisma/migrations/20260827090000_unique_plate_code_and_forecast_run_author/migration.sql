-- Two integrity gaps the schema described only by naming convention.
--
-- 1. cities.plate_code is the join key the forecast choropleth uses to match
--    a city to one of Türkiye's 81 province boundaries. Duplicated, one city
--    silently paints over the other and nothing reports it. This index will
--    fail on a database that already holds duplicates, which is the correct
--    outcome: a human has to decide which row is wrong.
--
-- 2. spatial_forecast_runs.created_by_id named admin_users.id without a
--    foreign key, so it could hold an account that never existed and
--    deleting an administrator left it dangling. Orphans are cleared to NULL
--    below before the constraint goes on, because they are already
--    meaningless and refusing to migrate over them helps nobody.

-- AlterTable
ALTER TABLE "spatial_forecast_runs" ALTER COLUMN "created_by_id" DROP NOT NULL;

UPDATE "spatial_forecast_runs"
SET "created_by_id" = NULL
WHERE "created_by_id" IS NOT NULL
  AND "created_by_id" NOT IN (SELECT "id" FROM "admin_users");

-- CreateIndex
CREATE UNIQUE INDEX "cities_plate_code_key" ON "cities"("plate_code");

-- CreateIndex
CREATE INDEX "spatial_forecast_runs_created_by_id_idx" ON "spatial_forecast_runs"("created_by_id");

-- AddForeignKey
ALTER TABLE "spatial_forecast_runs" ADD CONSTRAINT "spatial_forecast_runs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
