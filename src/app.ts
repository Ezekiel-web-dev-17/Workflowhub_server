import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import fileUpload from "express-fileupload";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import routes from "./routes/index.js";

/**
 * Creates and configures the Express application.
 * Separated from the server listener for testability.
 */
export function createApp(): express.Application {
    const app = express();

    // ─── Security ─────────────────────────────────────
    app.use(helmet());
    app.use(
        cors({
            origin: env.CORS_ORIGIN,
            credentials: true,
            methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
            allowedHeaders: [
                "Content-Type",
                "Authorization",
                "X-Requested-With",
            ],
        })
    );

    // ─── Body Parsing ─────────────────────────────────
    app.use(express.json({ limit: "10mb" }));
    app.use(express.urlencoded({ extended: true, limit: "10mb" }));
    app.use(cookieParser(env.COOKIE_SECRET));

    // ─── File Upload ──────────────────────────────────
    app.use(
        fileUpload({
            useTempFiles: false,
            // tempFileDir: "/tmp/",
            limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
            abortOnLimit: true,
        })
    );

    // ─── Logging ──────────────────────────────────────
    if (env.NODE_ENV === "development") {
        app.use(morgan("dev"));
    } else {
        app.use(morgan("combined"));
    }

    // ─── Routes ───────────────────────────────────────
    app.use("/api/v1", routes);

    // ─── Error Handling ───────────────────────────────
    app.use(notFoundHandler);
    app.use(errorHandler);

    return app;
}
