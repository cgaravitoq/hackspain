import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import ChatPanel from "../components/ChatPanel.vue";
import { alerts } from "./fixtures.ts";

function sse(chunks: object[]): Response {
  const body = [
    ...chunks.map((chunk) => `data: ${JSON.stringify(chunk)}`),
    "data: [DONE]",
  ].join("\n\n");
  return new Response(`${body}\n\n`, {
    headers: { "content-type": "text/event-stream" },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("ChatPanel", () => {
  it("sends the question with the company on screen and renders the streamed answer and tool calls", async () => {
    const requests: { url: string; body: string }[] = [];
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ url: String(input), body: String(init?.body) });
      return Promise.resolve(
        sse([
          { type: "start" },
          {
            type: "tool-input-available",
            toolCallId: "c1",
            toolName: "score",
            input: { company_id: "COMP_B" },
          },
          {
            type: "tool-output-available",
            toolCallId: "c1",
            output: { score: 91 },
          },
          { type: "text-start", id: "t" },
          {
            type: "text-delta",
            id: "t",
            delta: "COMP_B está sana con 91 puntos.",
          },
          { type: "text-end", id: "t" },
          { type: "finish" },
        ]),
      );
    });
    const wrapper = mount(ChatPanel, {
      props: { companyId: "COMP_A", alerts },
    });
    expect(wrapper.text()).toContain(
      "2 alertas, 1 empresas empeoran y 1 se recuperan",
    );
    await wrapper.find("input").setValue("¿Cómo está COMP_B?");
    await wrapper.find("form").trigger("submit");
    await flushPromises();
    await vi.waitFor(() =>
      expect(wrapper.text()).toContain("COMP_B está sana con 91 puntos."),
    );
    expect(requests[0]?.url).toBe("/api/chat");
    const body = JSON.parse(requests[0]?.body ?? "{}");
    expect(body.company_id).toBe("COMP_A");
    expect(body.messages[0].parts[0].text).toBe("¿Cómo está COMP_B?");
    expect(wrapper.find(".tool").text()).toBe('score {"company_id":"COMP_B"}');
  });
});
