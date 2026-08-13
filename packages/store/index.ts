import { PrismaClient, Prisma } from "./generated/prisma";

/**
 * Re-exports the Prisma namespace so consumers can reference Prisma types
 * (e.g. `Prisma.WebsiteWhereInput`) without importing directly from the generated client.
 */
export { Prisma };

/**
 * Singleton Prisma ORM client for the store package.
 *
 * Instantiated once at module load time and shared across the entire application.
 * Handles the connection to the PostgreSQL database defined by `DATABASE_URL`.
 */
export const prismaClient = new PrismaClient();
