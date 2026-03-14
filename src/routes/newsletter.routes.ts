import { Router } from "express";
import {
  subscribe,
  subscribers,
} from "../controllers/newsletter.controller.js";

export const newsletterRouter = Router();

newsletterRouter.post("/", subscribe);
newsletterRouter.get("/subscribers", subscribers);
