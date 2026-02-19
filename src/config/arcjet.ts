import arcjet, { shield, detectBot, tokenBucket } from "@arcjet/node";
import { env } from "./env.js";

const aj = arcjet({
    key: env.ARCJET_KEY,
    characteristics: ["ip.src"],
    rules: [
        // Shield protects against common attacks (SQL injection, XSS, etc.)
        shield({ mode: "LIVE" }),

        // Bot detection
        detectBot({
            mode: "LIVE",
            allow: [
                // Allow common good bots
                "CATEGORY:SEARCH_ENGINE",
                "CATEGORY:MONITOR",
                // Allow API testing tools (Postman, Insomnia, curl, etc.)
                "CURL",
            ],
        }),

        // Global rate limiting: 100 requests per 60 seconds
        tokenBucket({
            mode: "LIVE",
            refillRate: 100,
            interval: 60,
            capacity: 100,
        }),
    ],
});

export default aj;
