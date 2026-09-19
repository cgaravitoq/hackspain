import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import GroupStrip from "../components/GroupStrip.vue";
import { group } from "./fixtures.ts";

describe("GroupStrip", () => {
  it("emits the clicked member id through select", async () => {
    const wrapper = mount(GroupStrip, {
      props: { group, selected: "COMP_A" },
    });
    await wrapper.findAll("button")[1]?.trigger("click");
    expect(wrapper.emitted("select")).toEqual([["COMP_B"]]);
  });
});
