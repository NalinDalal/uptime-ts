-- CreateEnum
CREATE TYPE "maintenance_status" AS ENUM ('scheduled', 'in_progress', 'completed');

-- CreateTable
CREATE TABLE "maintenance" (
    "id" TEXT NOT NULL,
    "website_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3),
    "status" "maintenance_status" NOT NULL DEFAULT 'scheduled',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "maintenance" ADD CONSTRAINT "maintenance_website_id_fkey" FOREIGN KEY ("website_id") REFERENCES "website"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
