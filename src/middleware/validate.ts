import type { Request, Response, NextFunction } from "express";
import { validationResult, type ValidationChain } from "express-validator";
import { ValidationError } from "../utils/errors.js";

/**
 * Runs an array of validation chains and throws a
 * ValidationError if any of them fail.
 */
export function validate(validations: ValidationChain[]) {
    return async (
        req: Request,
        _res: Response,
        next: NextFunction
    ): Promise<void> => {
        // Run all validators
        await Promise.all(
            validations.map((validation) => validation.run(req))
        );

        const errors = validationResult(req);

        if (errors.isEmpty()) {
            return next();
        }

        // Group errors by field
        const fieldErrors: Record<string, string[]> = {};
        for (const error of errors.array()) {
            if (error.type === "field") {
                const field = error.path;
                if (!fieldErrors[field]) {
                    fieldErrors[field] = [];
                }
                fieldErrors[field].push(error.msg as string);
            }
        }

        next(new ValidationError("Validation failed", fieldErrors));
    };
}
