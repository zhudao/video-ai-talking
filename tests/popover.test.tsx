import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Popover } from "../src/components/Popover";

describe("Popover", () => {
  it("portals the panel to document.body so overflow parents cannot clip it", () => {
    render(
      <div className="overflow-hidden" data-testid="clipper" style={{ height: 40, width: 80 }}>
        <Popover title="编辑面板" trigger={<button type="button">打开</button>}>
          <p>完整内容</p>
        </Popover>
      </div>,
    );

    fireEvent.click(screen.getByRole("button", { name: "打开" }));

    const dialog = screen.getByRole("dialog", { name: "编辑面板" });
    expect(dialog).toBeVisible();
    expect(screen.getByTestId("clipper").contains(dialog)).toBe(false);
    expect(dialog.parentElement).toBe(document.body);
    expect(dialog).toHaveClass("fixed");
    expect(screen.getByText("完整内容")).toBeVisible();
  });
});
