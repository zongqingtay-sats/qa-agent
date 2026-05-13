/**
 * Singleton Prisma client for server-side database access.
 *
 * Uses the MSSQL adapter and caches the instance on `globalThis`
 * to avoid re-creating connections during Next.js hot-reloads.
 *
 * @module prisma
 */

import { PrismaClient } from '../generated/prisma/client';
import { PrismaMssql } from '@prisma/adapter-mssql';

const globalForPrisma = globalThis as unknown as { prisma: InstanceType<typeof PrismaClient> };

export const prisma =
  globalForPrisma.prisma ||
  (() => {
    const adapter = new PrismaMssql(process.env.DATABASE_URL!);
    return new PrismaClient({ adapter });
  })();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
