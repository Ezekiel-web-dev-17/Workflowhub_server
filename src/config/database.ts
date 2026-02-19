import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { logger } from "../utils/logger.js";

const connectionString = process.env["DATABASE_URL"]!;

// Create a PostgreSQL connection pool
const pool = new pg.Pool({ connectionString });

// Create the Prisma adapter for pg
const adapter = new PrismaPg(pool);

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        adapter,
        log:
            process.env["NODE_ENV"] === "development"
                ? ["query", "info", "warn", "error"]
                : ["error"],
    });

if (process.env["NODE_ENV"] !== "production") {
    globalForPrisma.prisma = prisma;
}

export async function connectDatabase(): Promise<void> {
    try {
        await prisma.$connect();
        logger.info("📦 Database connected successfully");
    } catch (error) {
        logger.error("❌ Database connection failed:", error);
        process.exit(1);
    }
}

export async function disconnectDatabase(): Promise<void> {
    await prisma.$disconnect();
    await pool.end();
    logger.info("📦 Database disconnected");
}
