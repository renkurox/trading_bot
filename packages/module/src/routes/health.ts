import Elysia from "elysia";
import { healthCheck } from "#/modules/health";

export const health = new Elysia().get("/health", healthCheck);
