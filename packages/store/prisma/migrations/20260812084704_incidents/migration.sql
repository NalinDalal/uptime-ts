-- CreateTable
CREATE TABLE "incident" (
    "id" TEXT NOT NULL,
    "website_id" TEXT NOT NULL,
    "region_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),

    CONSTRAINT "incident_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "incident" ADD CONSTRAINT "incident_website_id_fkey" FOREIGN KEY ("website_id") REFERENCES "website"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
