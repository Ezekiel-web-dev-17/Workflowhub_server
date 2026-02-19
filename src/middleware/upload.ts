import type { Request, Response, NextFunction } from "express";
import cloudinary from "../config/cloudinary.js";
import type { UploadedFile } from "express-fileupload";
import { BadRequestError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

export interface CloudinaryUploadResult {
    public_id: string;
    secure_url: string;
    width: number;
    height: number;
    format: string;
    bytes: number;
}

interface UploadOptions {
    folder: string;
    maxSizeMB?: number;
    allowedTypes?: string[];
    transformation?: Record<string, unknown>[];
}

const DEFAULT_MAX_SIZE_MB = 5;
const DEFAULT_ALLOWED_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
];

/**
 * Middleware factory for handling file uploads to Cloudinary.
 * Validates file type and size, then uploads and attaches the result.
 */
export function uploadToCloudinary(options: UploadOptions) {
    return async (
        req: Request,
        _res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            if (!req.files || !req.files.file) {
                return next(); // No file uploaded — skip
            }

            const file = req.files.file as UploadedFile;
            const maxSize =
                (options.maxSizeMB ?? DEFAULT_MAX_SIZE_MB) * 1024 * 1024;
            const allowedTypes =
                options.allowedTypes ?? DEFAULT_ALLOWED_TYPES;

            // Validate file type
            if (!allowedTypes.includes(file.mimetype)) {
                throw new BadRequestError(
                    `Invalid file type: ${file.mimetype}. Allowed: ${allowedTypes.join(", ")}`
                );
            }

            // Validate file size
            if (file.size > maxSize) {
                throw new BadRequestError(
                    `File too large. Maximum allowed: ${options.maxSizeMB ?? DEFAULT_MAX_SIZE_MB}MB`
                );
            }

            // Upload to Cloudinary
            const result = await cloudinary.uploader.upload(
                file.tempFilePath || `data:${file.mimetype};base64,${file.data.toString("base64")}`,
                {
                    folder: options.folder,
                    resource_type: "auto",
                    ...(options.transformation && {
                        transformation: options.transformation,
                    }),
                }
            );

            // Attach result to request body
            req.body.uploadedFile = {
                public_id: result.public_id,
                secure_url: result.secure_url,
                width: result.width,
                height: result.height,
                format: result.format,
                bytes: result.bytes,
            } satisfies CloudinaryUploadResult;

            logger.info(`File uploaded to Cloudinary: ${result.public_id}`);
            next();
        } catch (error) {
            next(error);
        }
    };
}

/**
 * Deletes a file from Cloudinary by its public ID.
 */
export async function deleteFromCloudinary(
    publicId: string
): Promise<void> {
    await cloudinary.uploader.destroy(publicId);
    logger.info(`File deleted from Cloudinary: ${publicId}`);
}
