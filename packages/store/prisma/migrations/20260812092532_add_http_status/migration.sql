-- AlterTable
ALTER TABLE "website_tick" ADD COLUMN     "http_status" INTEGER;

-- CreateIndex
CREATE INDEX "website_tick_website_id_created_at_idx" ON "website_tick"("website_id", "created_at");

-- CreateIndex
CREATE INDEX "website_tick_website_id_region_id_created_at_idx" ON "website_tick"("website_id", "region_id", "created_at");
