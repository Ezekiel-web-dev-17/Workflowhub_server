import winston from "winston";

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack }) => {
    return `${timestamp as string} [${level}]: ${(stack as string) || (message as string)}`;
});

export const logger = winston.createLogger({
    level: process.env["NODE_ENV"] === "development" ? "debug" : "info",
    format: combine(
        timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        errors({ stack: true }),
        logFormat
    ),
    defaultMeta: { service: "workflowhub-api" },
    transports: [
        new winston.transports.Console({
            format: combine(colorize(), logFormat),
        }),
        new winston.transports.File({
            filename: "logs/error.log",
            level: "error",
        }),
        new winston.transports.File({
            filename: "logs/combined.log",
        }),
    ],
});

// In production, don't log to console (use file transports only)
if (process.env["NODE_ENV"] === "production") {
    logger.remove(new winston.transports.Console());
}
