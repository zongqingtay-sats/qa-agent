import { PrismaClient } from '../generated/prisma/client';
import { PrismaMssql } from '@prisma/adapter-mssql';
import { appConfig } from '../config';

// Singleton Prisma client
let prisma: InstanceType<typeof PrismaClient> | null = null;

export function getPrismaClient(): InstanceType<typeof PrismaClient> {
  if (!prisma) {
    const adapter = new PrismaMssql(appConfig.databaseUrl);
    prisma = new PrismaClient({ adapter });
  }
  return prisma;
}

export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}
