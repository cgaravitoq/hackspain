import {
  alertKindSchema,
  chatRequestSchema,
  commitmentRequestSchema,
  environmentSchema,
  type HealthResponse,
  relationConfidenceSchema,
  relationScopeSchema,
  relationTypeSchema,
  roleSchema,
  stateSchema,
} from "@hackspain/shared";
import { StreamableHTTPTransport } from "@hono/mcp";
import type { LanguageModel } from "ai";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import { chat, workersAiModel } from "./xray/chat.ts";
import { commitmentContext } from "./xray/commitment.ts";
import { createMcpServer } from "./xray/mcp.ts";
import { loadReport } from "./xray/report.ts";
import { renderReportHtml } from "./xray/report-html.ts";
import {
  type ReportBrowser,
  reportFilename,
  reportPdf,
} from "./xray/report-pdf.ts";
import { createReportTool } from "./xray/report-tool.ts";
import { simulateCompany, simulateQuery } from "./xray/simulate.ts";
import { createStore } from "./xray/store.ts";
import { createTools } from "./xray/tools.ts";

export type AppOptions = {
  model?: (env: Env) => LanguageModel;
  browser?: ReportBrowser;
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

const compareQuerySchema = z.object({
  ids: z
    .string()
    .transform((value) => value.split(",").map((id) => id.trim()))
    .pipe(z.array(z.string().min(1)).min(1).max(3)),
});

const graphQuerySchema = z.object({
  type: relationTypeSchema.optional(),
  confidence: relationConfidenceSchema.optional(),
  scope: relationScopeSchema.optional(),
  group_id: z.string().optional(),
  include_isolated: z.stringbool().default(false),
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

  app.get("/companies/:id/explain", async (context) => {
    const explanation = await createTools(createStore(context.env.DB)).explain({
      company_id: context.req.param("id"),
    });
    return "error" in explanation
      ? context.json(explanation, 404)
      : context.json(explanation);
  });

  app.get("/companies/:id/commitment-context", async (context) => {
    const store = createStore(context.env.DB);
    const company = await store.company(
      await store.resolveCompany(context.req.param("id")),
    );
    return company
      ? context.json(commitmentContext(company))
      : context.json({ error: "Unknown company" }, 404);
  });

  app.post(
    "/companies/:id/commitment",
    bodyLimit({ maxSize: 65_536 }),
    async (context) => {
      const request = commitmentRequestSchema.safeParse(
        await context.req.json().catch(() => null),
      );
      if (!request.success) {
        return context.json({ error: z.treeifyError(request.error) }, 400);
      }
      const result = await createTools(
        createStore(context.env.DB),
      ).simulate_commitment({
        company_id: context.req.param("id"),
        ...request.data,
      });
      context.header("cache-control", "private, no-store");
      return "error" in result
        ? context.json(result, 404)
        : context.json(result);
    },
  );

  app.get("/compare", async (context) => {
    const query = compareQuerySchema.safeParse(context.req.query());
    if (!query.success) {
      return context.json(
        { error: "ids takes between 1 and 3 companies" },
        400,
      );
    }
    const comparison = await createTools(createStore(context.env.DB)).compare({
      company_ids: query.data.ids,
    });
    return "error" in comparison
      ? context.json(comparison, 404)
      : context.json(comparison);
  });

  app.get("/companies/:id/simulate", async (context) => {
    const query = simulateQuery.safeParse(context.req.query());
    if (!query.success) {
      return context.json(
        { error: query.error.issues[0]?.message ?? "Invalid query" },
        400,
      );
    }
    const simulation = await simulateCompany(createStore(context.env.DB), {
      ...query.data,
      company: context.req.param("id"),
    });
    return "error" in simulation
      ? context.json(simulation, 404)
      : context.json(simulation);
  });

  app.get("/companies/:id/report", async (context) => {
    const role = roleSchema.safeParse(context.req.query("role"));
    if (!role.success) {
      return context.json({ error: "Unknown role" }, 400);
    }
    const report = await loadReport(
      context.env.DB,
      () => model(context.env),
      context.req.param("id"),
      role.data,
    );
    return context.json(report);
  });

  app.get("/companies/:id/report.pdf", async (context) => {
    const role = roleSchema.safeParse(context.req.query("role"));
    if (!role.success) {
      return context.json({ error: "Unknown role" }, 400);
    }
    const report = await loadReport(
      context.env.DB,
      () => model(context.env),
      context.req.param("id"),
      role.data,
    );
    const pdf = await reportPdf(
      context.env.DB,
      options.browser ?? context.env.BROWSER,
      report,
    );
    return new Response(pdf, {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="${reportFilename(report)}"`,
        "cache-control": "private, max-age=3600",
        "x-content-type-options": "nosniff",
      },
    });
  });

  app.get("/companies/:id/report.html", async (context) => {
    const role = roleSchema.safeParse(context.req.query("role"));
    if (!role.success) {
      return context.json({ error: "Unknown role" }, 400);
    }
    const report = await loadReport(
      context.env.DB,
      () => model(context.env),
      context.req.param("id"),
      role.data,
    );
    context.header("cache-control", "private, no-store");
    context.header("x-content-type-options", "nosniff");
    return context.html(renderReportHtml(report));
  });

  app.get("/companies/:id/relations", async (context) => {
    const relations = await createStore(context.env.DB).companyRelations(
      context.req.param("id"),
    );
    return relations
      ? context.json(relations)
      : context.json({ error: "Unknown company" }, 404);
  });

  app.get("/groups/:id", async (context) => {
    const group = await createTools(createStore(context.env.DB)).group_map({
      group_id: context.req.param("id"),
    });
    return "error" in group ? context.json(group, 404) : context.json(group);
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

  app.get("/graph", async (context) => {
    const query = graphQuerySchema.safeParse(context.req.query());
    if (!query.success) {
      return context.json({ error: z.treeifyError(query.error) }, 400);
    }
    const graph = await createStore(context.env.DB).graph(query.data);
    return graph
      ? context.json(graph)
      : context.json({ error: "No relations loaded" }, 404);
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
    return chat(
      model(context.env),
      createStore(context.env.DB),
      request.data,
      createReportTool(
        context.env.DB,
        () => model(context.env),
        options.browser ?? context.env.BROWSER,
        "/api",
      ),
    );
  });

  app.all("/mcp", async (context) => {
    const transport = new StreamableHTTPTransport({ enableJsonResponse: true });
    await createMcpServer(
      createStore(context.env.DB),
      createReportTool(
        context.env.DB,
        () => model(context.env),
        options.browser ?? context.env.BROWSER,
        new URL(context.req.url).origin,
      ),
    ).connect(transport);
    const response = await transport.handleRequest(context);
    return response ?? context.body(null, 204);
  });

  return app;
}
