import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { z } from "zod";
import {
  type ReportTool,
  reportDescription,
  reportInput,
} from "./report-tool.ts";
import {
  simulateCompany,
  simulateDescription,
  simulateInput,
} from "./simulate.ts";
import type { Store } from "./store.ts";
import {
  createTools,
  type ToolOutput,
  toolDescriptions,
  toolInputs,
} from "./tools.ts";

function register<Schema extends z.ZodObject>(
  server: McpServer,
  name: string,
  description: string,
  schema: Schema,
  run: (input: z.infer<Schema>) => Promise<ToolOutput>,
) {
  server.registerTool(
    name,
    { description, inputSchema: schema.shape },
    async (input) => ({
      content: [
        { type: "text", text: JSON.stringify(await run(schema.parse(input))) },
      ],
    }),
  );
}

export function createMcpServer(store: Store, report: ReportTool): McpServer {
  const server = new McpServer({ name: "xray", version: "0.1.0" });
  const tools = createTools(store);
  register(
    server,
    "score",
    toolDescriptions.score,
    toolInputs.score,
    tools.score,
  );
  register(
    server,
    "explain",
    toolDescriptions.explain,
    toolInputs.explain,
    tools.explain,
  );
  register(
    server,
    "what_changed",
    toolDescriptions.what_changed,
    toolInputs.what_changed,
    tools.what_changed,
  );
  register(
    server,
    "group_map",
    toolDescriptions.group_map,
    toolInputs.group_map,
    tools.group_map,
  );
  register(
    server,
    "compare",
    toolDescriptions.compare,
    toolInputs.compare,
    tools.compare,
  );
  register(
    server,
    "alerts",
    toolDescriptions.alerts,
    toolInputs.alerts,
    tools.alerts,
  );
  server.registerTool(
    "simulate",
    { description: simulateDescription, inputSchema: simulateInput.shape },
    async (input) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            await simulateCompany(store, simulateInput.parse(input)),
          ),
        },
      ],
    }),
  );
  server.registerTool(
    "report",
    { description: reportDescription, inputSchema: reportInput.shape },
    async (input) => {
      const file = await report(reportInput.parse(input));
      return {
        content: [
          {
            type: "text",
            text: `Informe listo (PDF, ${file.sizeBytes} bytes): ${file.url}`,
          },
        ],
        structuredContent: file,
      };
    },
  );
  register(
    server,
    "relations",
    toolDescriptions.relations,
    toolInputs.relations,
    tools.relations,
  );
  return server;
}
