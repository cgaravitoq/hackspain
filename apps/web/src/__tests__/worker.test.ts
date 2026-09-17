import { describe, expect, it } from "vitest";
import { proxyToAgent } from "../worker.ts";

function fakeAgent(seen: Request[]) {
  return {
    fetch(input: RequestInfo | URL, init?: RequestInit) {
      seen.push(new Request(input, init));
      return Promise.resolve(new Response("ok"));
    },
  };
}

describe("proxyToAgent", () => {
  it("strips the /api prefix and keeps method and query", async () => {
    const seen: Request[] = [];
    await proxyToAgent(
      new Request("https://web.test/api/health?verbose=1", { method: "POST" }),
      fakeAgent(seen),
    );
    expect(seen[0]?.url).toBe("https://web.test/health?verbose=1");
    expect(seen[0]?.method).toBe("POST");
  });

  it("maps a bare /api to the agent root", async () => {
    const seen: Request[] = [];
    await proxyToAgent(new Request("https://web.test/api"), fakeAgent(seen));
    expect(seen[0]?.url).toBe("https://web.test/");
  });
});
