import { NextFunction, Response, Request } from "express";
import { successResponse } from "../utils/apiResponse.js";
import { prisma } from "../config/database.js";
import { requireUserId } from "./workflows.controller.js";
import { ForbiddenError } from "../utils/errors.js";

export const subscribe = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const email: string = req.body.email;
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    if (!email || !email.includes("@")) {
      throw Error("A valid email is required.");
    }

    if (!emailRegex.test(email)) {
      throw Error("Invalid email!");
    }
    // A small sample of common disposable domains.
    // For a production app, you can fetch an updated list via a cron job.
    const DISPOSABLE_DOMAINS = new Set([
      "mailinator.com",
      "10minutemail.com",
      "temp-mail.org",
      "guerrillamail.com",
    ]);

    const cleanEmail = email.trim().toLowerCase();

    const parts = cleanEmail.split("@");
    const domain = parts[1]; // TypeScript still thinks this could be undefined

    if (!domain) {
      return res.status(400).json({ error: "Invalid email domain." });
    }

    if (DISPOSABLE_DOMAINS.has(domain))
      throw new Error(
        "Temporary or disposable emails are not allowed. Please use a permanent email address.",
      );

    if (email.length > 50) throw Error("Email too long");

    await prisma.workflow.create({
      data: {
        email: email.trim().toLowerCase().substring(0, 50),
      },
    });

    return successResponse(
      res,
      "Subscribe for our newsletter successfully.",
      200,
    );
  } catch (error: any) {
    if (error.code === "P2002") {
      return res
        .status(400)
        .json({ error: "This email is already subscribed." });
    }
    next(error);
  }
};

export const subscribers = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const requesterId = requireUserId(req);

    const user = await prisma.user.findUnique({
      where: { id: requesterId },
      select: { role: true },
    });

    const isAdmin = user?.role === "ADMIN";

    if (!isAdmin)
      throw new ForbiddenError(
        "Only admins are allowed access to this resource!",
      );

    const subscribers = await prisma.workflow.findMany({ where: { email } });

    return successResponse(res, "Subscribers found", subscribers, 200);
  } catch (error) {
    next(error);
  }
};
