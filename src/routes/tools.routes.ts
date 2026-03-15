import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import {
  get_tools,
  get_tool,
  create_tool,
  update_tool,
  delete_tool,
  add_review,
  update_review,
  delete_review,
  getToolsNamesOnly,
} from "../controllers/tools.controller.js";
import { uploadToCloudinary } from "../middleware/upload.js";

const router = Router();

// ─── Public ───────────────────────────────────────────────────────────────────
router.get("/", get_tools);
router.get("/names", getToolsNamesOnly);
router.get("/:id", get_tool);

// ─── Admin-only (create/update/delete tools) ──────────────────────────────────
router.post(
  "/",
  authenticate,
  authorize("ADMIN"),
  uploadToCloudinary({
    folder: "tools",
    transformation: [
      { width: 20, height: 20, crop: "fill" },
      { width: 44, height: 38, crop: "fill" },
    ],
  }),
  create_tool,
);
router.patch(
  "/:id",
  authenticate,
  uploadToCloudinary({
    folder: "tools",
    transformation: [
      { width: 20, height: 20, crop: "fill" },
      { width: 44, height: 38, crop: "fill" },
    ],
  }),
  update_tool,
);
router.delete("/:id", authenticate, authorize("ADMIN"), delete_tool);

// ─── Authenticated users (reviews) ───────────────────────────────────────────
router.post("/:id/reviews", authenticate, add_review);
router.patch("/:id/reviews", authenticate, update_review);
router.delete("/:id/reviews", authenticate, delete_review);

export default router;
