import { type DOMWrapper, mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import Sparkline from "../components/Sparkline.vue";
import { company, month } from "./fixtures.ts";

function withMonths(id: string, months: string[]) {
  return {
    ...company(id, "GROUP_1"),
    series: months.map((name) => month(name, 50, "stable")),
  };
}

function pointX(circles: DOMWrapper<Element>[], id: string, name: string) {
  const circle = circles.find((candidate) =>
    candidate.find("title").text().includes(`${id} · ${name}`),
  );
  return Number(circle?.attributes("cx"));
}

describe("Sparkline", () => {
  it("draws a month that only the second company holds", () => {
    const wrapper = mount(Sparkline, {
      props: {
        companies: [
          withMonths("COMP_A", ["2026-06", "2026-07"]),
          withMonths("COMP_B", ["2026-06", "2026-07", "2026-08"]),
        ],
      },
    });
    const titles = wrapper.findAll("circle title").map((title) => title.text());
    expect(titles.filter((text) => text.includes("2026-08"))).toEqual([
      expect.stringContaining("COMP_B · 2026-08"),
    ]);
    expect(wrapper.findAll("circle")).toHaveLength(5);
  });

  it("orders the axis by month whatever order the companies report", () => {
    const wrapper = mount(Sparkline, {
      props: {
        companies: [
          withMonths("COMP_A", ["2026-07", "2026-08"]),
          withMonths("COMP_B", ["2026-05", "2026-06"]),
        ],
      },
    });
    expect(wrapper.findAll("text.month").map((label) => label.text())).toEqual([
      "2026-05",
      "2026-08",
    ]);
    const circles = wrapper.findAll("circle");
    expect(pointX(circles, "COMP_B", "2026-06")).toBeLessThan(
      pointX(circles, "COMP_A", "2026-07"),
    );
  });

  it("labels the legend with the demo name when there is one, else the id", () => {
    const wrapper = mount(Sparkline, {
      props: {
        companies: [
          company("COMP_0176", "GROUP_1"),
          company("COMP_A", "GROUP_1"),
        ],
      },
    });
    expect(wrapper.findAll(".legend span").map((item) => item.text())).toEqual([
      "Talleres Ribera",
      "COMP_A",
    ]);
  });
});
