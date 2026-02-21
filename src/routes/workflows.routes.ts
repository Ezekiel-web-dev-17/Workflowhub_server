import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import {
    get_workflows,
    get_workflow_by,
    get_workflow_by_id,
    create_workflow,
    update_workflow,
    delete_workflow,
    update_workflow_likes,
    update_workflow_views,
    update_workflow_clones,
    create_workflow_comment,
} from "../controllers/workflows.controller.js";
import { uploadToCloudinary } from "../middleware/upload.js";

const router = Router();

// ─── Public routes ────────────────────────────────────────────────────────────
router.get("/", get_workflows);
router.get("/search", get_workflow_by);
router.get("/:id", get_workflow_by_id);

// view count — public, called by client on page load
router.post("/:id/view", update_workflow_views);

// ─── Protected routes ─────────────────────────────────────────────────────────
router.post("/", authenticate, uploadToCloudinary({ folder: "workflows" }), create_workflow);
router.patch("/:id", authenticate, uploadToCloudinary({ folder: "workflows" }), update_workflow);
router.delete("/:id", authenticate, delete_workflow);
router.post("/:id/like", authenticate, update_workflow_likes);
router.post("/:id/clone", authenticate, update_workflow_clones);
router.post("/:id/comments", authenticate, create_workflow_comment);

export default router;
