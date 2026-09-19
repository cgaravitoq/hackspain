import {
  alertKindSchema,
  chatRequestSchema,
  environmentSchema,
  type HealthResponse,
  stateSchema,
} from "@hackspain/shared";
import { StreamableHTTPTransport } from "@hono/mcp";
import type { LanguageModel } from "ai";
import { Hono } from "hono";
import { z } from "zod";
import { chat, workersAiModel } from "./xray/chat.ts";
import { createMcpServer } from "./xray/mcp.ts";
import { createStore } from "./xray/store.ts";

export type AppOptions = {
  model?: (env: Env) => LanguageModel;
};

const companiesQuerySchema = z.object({
  state: stateSchema.optional(),
  group_id: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(2000).default(2000),
});

const alertsQuerySchema = z.object({
  kind: alertKindSchema.optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export function createApp(options: AppOptions = {}) {
  const model = options.model ?? ((env: Env) => workersAiModel(env.AI));
  const app = new Hono<{ Bindings: Env }>();

  app.get("/health", (context) => {
    const body: HealthResponse = {
      ok: true,
      environment: environmentSchema.parse(context.env.ENVIRONMENT),
    };
    return context.json(body);
  });

  app.get("/companies", async (context) => {
    const query = companiesQuerySchema.safeParse(context.req.query());
    if (!query.success) {
      return context.json({ error: z.treeifyError(query.error) }, 400);
    }
    const companies = await createStore(context.env.DB).companies(query.data);
    return context.json({ companies });
  });

  app.get("/companies/:id", async (context) => {
    const company = await createStore(context.env.DB).company(
      context.req.param("id"),
    );
    return company
      ? context.json(company)
      : context.json({ error: "Unknown company" }, 404);
  });

  app.get("/groups/:id", async (context) => {
    const group = await createStore(context.env.DB).group(
      context.req.param("id"),
    );
    return group
      ? context.json(group)
      : context.json({ error: "Unknown group" }, 404);
  });

  app.get("/alerts", async (context) => {
    const query = alertsQuerySchema.safeParse(context.req.query());
    if (!query.success) {
      return context.json({ error: z.treeifyError(query.error) }, 400);
    }
    const alerts = await createStore(context.env.DB).alerts(
      query.data.kind,
      query.data.limit,
    );
    return context.json({ alerts });
  });

  app.get("/backtest", async (context) => {
    const backtest = await createStore(context.env.DB).backtest();
    return backtest
      ? context.json(backtest)
      : context.json({ error: "No backtest loaded" }, 404);
  });

  app.get("/meta", async (context) => {
    const meta = await createStore(context.env.DB).meta();
    return meta
      ? context.json(meta)
      : context.json({ error: "No dataset loaded" }, 404);
  });

  app.post("/chat", async (context) => {
    const request = chatRequestSchema.safeParse(await context.req.json());
    if (!request.success) {
      return context.json({ error: z.treeifyError(request.error) }, 400);
    }
    return chat(model(context.env), createStore(context.env.DB), request.data);
  });

  app.all("/mcp", async (context) => {
    const transport = new StreamableHTTPTransport({ enableJsonResponse: true });
    await createMcpServer(createStore(context.env.DB)).connect(transport);
    const response = await transport.handleRequest(context);
    return response ?? context.body(null, 204);
  });

  return app;
}
