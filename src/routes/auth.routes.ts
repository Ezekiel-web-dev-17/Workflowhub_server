import { Router } from "express";
import { body } from "express-validator";
import {
  register,
  login,
  refreshToken,
  logout,
  getMe,
} from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();

// ─── Register ─────────────────────────────────────────
router.post(
  "/register",
  validate([
    body("name")
      .trim()
      .notEmpty()
      .withMessage("Name is required")
      .isLength({ min: 2, max: 50 })
      .withMessage("Name must be 2–50 characters"),
    body("email")
      .trim()
      .isEmail()
      .withMessage("Valid email is required")
      .normalizeEmail(),
    body("password")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters")
      .matches(/[A-Z]/)
      .withMessage("Password must contain at least one uppercase letter")
      .matches(/[a-z]/)
      .withMessage("Password must contain at least one lowercase letter")
      .matches(/\d/)
      .withMessage("Password must contain at least one number"),
    body("role").optional().isIn(["ADMIN", "USER"]),
  ]),
  register,
);

// ─── Login ────────────────────────────────────────────
router.post(
  "/login",
  validate([
    body("email")
      .trim()
      .isEmail()
      .withMessage("Valid email is required")
      .normalizeEmail(),
    body("password").notEmpty().withMessage("Password is required"),
  ]),
  login,
);

// ─── Refresh Token ────────────────────────────────────
router.post("/refresh-token", refreshToken);

// ─── Logout ───────────────────────────────────────────
router.post("/logout", authenticate, logout);

// ─── Get Current User ─────────────────────────────────
router.get("/me", authenticate, getMe);

export default router;
