import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { connectDatabase, disconnectDatabase } from "./config/database.js";
import { disconnectRedis } from "./config/redis.js";
import { logger } from "./utils/logger.js";

const app = createApp();

// ─── Start Server ─────────────────────────────────────
async function startServer(): Promise<void> {
    try {
        // Connect to database
        await connectDatabase();

        app.listen(env.PORT, () => {
            logger.info(
                `🚀 Server running on port ${env.PORT} in ${env.NODE_ENV} mode`
            );
            logger.info(`📡 API available at http://localhost:${env.PORT}/api/v1`);
        });
    } catch (error) {
        logger.error("Failed to start server:", error);
        process.exit(1);
    }
}

// ─── Graceful Shutdown ────────────────────────────────
function handleShutdown(signal: string): void {
    logger.info(`\n${signal} received. Shutting down gracefully...`);
    Promise.all([disconnectDatabase(), disconnectRedis()])
        .then(() => {
            logger.info("Server shut down successfully");
            process.exit(0);
        })
        .catch((error) => {
            logger.error("Error during shutdown:", error);
            process.exit(1);
        });
}

process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason: unknown) => {
    logger.error("Unhandled Rejection:", reason);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error: Error) => {
    logger.error("Uncaught Exception:", error);
    process.exit(1);
});

startServer();

export default app;