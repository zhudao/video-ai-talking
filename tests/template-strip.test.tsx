import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TemplateStrip } from "../src/components/ComposeForm";
import type { Template } from "../src/lib/api";

const templates: Template[] = [
  { id: "red-bold", name: "高级红", description: "红", mediaFit: "cover" },
  { id: "plain-white", name: "简白", description: "白", mediaFit: "contain" },
];

describe("TemplateStrip", () => {
  it("marks selected templates and toggles them off when clicked again", () => {
    const onTemplateIdsChange = vi.fn();
    const onActiveIdChange = vi.fn();
    render(
      <TemplateStrip
        templates={templates}
        templateIds={["red-bold"]}
        activeId="red-bold"
        onTemplateIdsChange={onTemplateIdsChange}
        onActiveIdChange={onActiveIdChange}
      />,
    );
    const selected = screen.getByRole("button", { name: /高级红/ });
    expect(selected).toHaveAttribute("aria-pressed", "true");
    expect(selected).toHaveTextContent("已选");

    const idle = screen.getByRole("button", { name: /简白/ });
    expect(idle).toHaveAttribute("aria-pressed", "false");
    expect(idle).not.toHaveTextContent("已选");

    fireEvent.click(selected);
    expect(onTemplateIdsChange).toHaveBeenCalledWith([]);
    expect(onActiveIdChange).toHaveBeenCalledWith(null);
  });

  it("selects an idle template and only previews a selected one that is not active", () => {
    const onTemplateIdsChange = vi.fn();
    const onActiveIdChange = vi.fn();
    render(
      <TemplateStrip
        templates={templates}
        templateIds={["red-bold"]}
        activeId="red-bold"
        onTemplateIdsChange={onTemplateIdsChange}
        onActiveIdChange={onActiveIdChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /简白/ }));
    expect(onTemplateIdsChange).toHaveBeenCalledWith(["plain-white"]);
    expect(onActiveIdChange).toHaveBeenCalledWith("plain-white");
  });

  it("previews another already selected template without deselecting it", () => {
    const onTemplateIdsChange = vi.fn();
    const onActiveIdChange = vi.fn();
    render(
      <TemplateStrip
        templates={templates}
        templateIds={["red-bold", "plain-white"]}
        activeId="red-bold"
        onTemplateIdsChange={onTemplateIdsChange}
        onActiveIdChange={onActiveIdChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /简白/ }));
    expect(onTemplateIdsChange).not.toHaveBeenCalled();
    expect(onActiveIdChange).toHaveBeenCalledWith("plain-white");
  });
});
