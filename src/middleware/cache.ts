import { getCache, setCache } from "../config/redis.js";
import { NextFunction, Request, Response } from "express";
import { logger } from "../utils/logger.js";

export const redisCache = (handler: any) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const cacheKey = req.url;
            const cachedResponse = await getCache(cacheKey);
            if (cachedResponse) {
                logger.info("Returning cached response for key:", cacheKey);
                res.json(cachedResponse);
                return;
            }

            // Intercept res.json to cache the response body before sending it
            const originalJson = res.json;
            res.json = function (body) {
                res.json = originalJson; // Restore the original method
                logger.info("Caching response for key:", cacheKey);
                setCache(cacheKey, body, 2 * 60).catch(err => {
                    logger.error("Redis Cache Error:", err);
                });
                return originalJson.call(this, body);
            };

            await handler(req, res, next);
        } catch (error) {
            next(error);
        }
    };
};