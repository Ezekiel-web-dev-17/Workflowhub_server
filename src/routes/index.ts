import { Router } from "express";
import healthRoutes from "./health.routes.js";
import authRoutes from "./auth.routes.js";
import workflowRoutes from "./workflows.routes.js";
import toolRoutes from "./tools.routes.js";
import { newsletterRouter } from "./newsletter.routes.js";

const router = Router();

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/workflows", workflowRoutes);
router.use("/tools", toolRoutes);
router.use("/newsletter", newsletterRouter);

export default router;
