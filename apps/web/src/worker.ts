const API_PREFIX = "/api";

type Agent = Pick<Fetcher, "fetch">;

export function proxyToAgent(
  request: Request,
  agent: Agent,
): Promise<Response> {
  const url = new URL(request.url);
  url.pathname = url.pathname.slice(API_PREFIX.length) || "/";
  return agent.fetch(new Request(url, request));
}

export default {
  fetch(request, env) {
    return proxyToAgent(request, env.AGENT);
  },
} satisfies ExportedHandler<Env>;
