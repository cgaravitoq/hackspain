import { environmentSchema, type HealthResponse } from "@hackspain/shared";
import { Hono } from "hono";

export function createApp() {
  const app = new Hono<{ Bindings: Env }>();

  app.get("/health", (context) => {
    const body: HealthResponse = {
      ok: true,
      environment: environmentSchema.parse(context.env.ENVIRONMENT),
    };
    return context.json(body);
  });

  return app;
}
