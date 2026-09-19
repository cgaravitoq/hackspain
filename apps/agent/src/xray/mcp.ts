import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { z } from "zod";
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

export function createMcpServer(store: Store): McpServer {
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
    "alerts",
    toolDescriptions.alerts,
    toolInputs.alerts,
    tools.alerts,
  );
  return server;
}
