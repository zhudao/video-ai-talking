import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CutawaySection, ReferenceSection } from "../src/components/ComposeForm";
import { FileDrop } from "../src/components/FileDrop";
import { api } from "../src/lib/api";

describe("FileDrop", () => {
  it("browses local files instead of copying through a hidden input", () => {
    const onBrowse = vi.fn();
    render(
      <FileDrop
        accept="image/*"
        multiple
        label="添加图片或视频"
        hint="直接引用原文件"
        onBrowse={onBrowse}
      />,
    );
    expect(document.querySelector('input[type="file"]')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "选择文件" }));
    expect(onBrowse).toHaveBeenCalled();
  });
});

function renderMaterials(
  materials: Parameters<typeof ReferenceSection>[0]["materials"] = [],
  onMaterialsChange = async () => undefined,
  referenceId: string | null = null,
  onReferenceIdChange: (id: string | null) => void = () => undefined,
) {
  return render(
    <>
      <ReferenceSection
        materials={materials}
        referenceId={referenceId}
        onReferenceIdChange={onReferenceIdChange}
        onMaterialsChange={onMaterialsChange}
      />
      <CutawaySection
        materials={materials}
        referenceId={referenceId}
        onMaterialsChange={onMaterialsChange}
      />
    </>,
  );
}

describe("reference and cutaway sections", () => {
  it("only offers file pick and drop, not folder import", () => {
    renderMaterials();
    expect(screen.getAllByRole("button", { name: "选择文件" }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("添加口播真人视频")).toBeInTheDocument();
    expect(screen.getByText(/不用念台词/)).toBeInTheDocument();
    expect(screen.getByText(/不要侧脸、远景、多人或脸被挡住/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "添加文件夹" })).not.toBeInTheDocument();
    expect(screen.queryByText(/选文件夹/)).not.toBeInTheDocument();
  });

  it("previews the selected talking-head reference video", () => {
    renderMaterials(
      [
        {
          id: "ref1",
          filename: "face.mp4",
          mime: "video/mp4",
          kind: "video",
          ext: "mp4",
          createdAt: "",
          url: "/files/materials/ref1.mp4",
        },
      ],
      async () => undefined,
      "ref1",
    );
    const preview = screen.getByLabelText("口播真人视频预览");
    expect(preview.tagName).toBe("VIDEO");
    expect(preview).toHaveAttribute("src", "/files/materials/ref1.mp4");
    expect(preview).toHaveAttribute("controls");
    expect(screen.getByText("face.mp4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "替换" })).toBeInTheDocument();
    expect(screen.getByText(/不用念台词/)).toBeInTheDocument();
  });

  it("switches the talking-head to an already-linked video on 替换", async () => {
    const existing = {
      id: "mid1",
      filename: "talking-mid-cn.mp4",
      mime: "video/mp4",
      kind: "video" as const,
      ext: "mp4",
      createdAt: "",
      url: "/files/materials/mid1.mp4",
    };
    const browseFiles = vi.spyOn(api, "browseFiles").mockResolvedValue({
      cancelled: false,
      added: 0,
      skipped: 0,
      truncated: false,
      materials: [existing],
    });
    const onReferenceIdChange = vi.fn();
    renderMaterials(
      [
        {
          id: "ref1",
          filename: "face.mp4",
          mime: "video/mp4",
          kind: "video",
          ext: "mp4",
          createdAt: "",
          url: "/files/materials/ref1.mp4",
        },
        existing,
      ],
      async () => undefined,
      "ref1",
      onReferenceIdChange,
    );
    fireEvent.click(screen.getByRole("button", { name: "替换" }));
    await vi.waitFor(() => {
      expect(browseFiles).toHaveBeenCalledWith({ kinds: ["video"] });
      expect(onReferenceIdChange).toHaveBeenCalledWith("mid1");
    });
    browseFiles.mockRestore();
  });

  it("links dropped local paths without uploading bytes", async () => {
    const linkFiles = vi.spyOn(api, "linkFiles").mockResolvedValue({
      added: 2,
      skipped: 0,
      truncated: false,
      materials: [],
    });
    const onMaterialsChange = vi.fn(async () => undefined);
    renderMaterials([], onMaterialsChange);
    const zone = screen.getByText("添加图片或视频").parentElement!.parentElement!;
    fireEvent.drop(zone, {
      dataTransfer: {
        files: [],
        getData: (type: string) =>
          type === "text/uri-list" ? "file:///Users/me/a.jpg\nfile:///Users/me/b.mp4" : "",
      },
    });
    await vi.waitFor(() => {
      expect(linkFiles).toHaveBeenCalledWith(["/Users/me/a.jpg", "/Users/me/b.mp4"], { kinds: ["image", "video"] });
      expect(onMaterialsChange).toHaveBeenCalled();
    });
    linkFiles.mockRestore();
  });

  it("opens the native file picker from 选择文件", async () => {
    const browseFiles = vi.spyOn(api, "browseFiles").mockResolvedValue({
      cancelled: false,
      added: 1,
      skipped: 0,
      truncated: false,
      materials: [],
    });
    const onMaterialsChange = vi.fn(async () => undefined);
    renderMaterials([], onMaterialsChange);
    fireEvent.click(screen.getAllByRole("button", { name: "选择文件" })[1]!);
    await vi.waitFor(() => {
      expect(browseFiles).toHaveBeenCalledWith({ kinds: ["image", "video"] });
      expect(onMaterialsChange).toHaveBeenCalled();
    });
    browseFiles.mockRestore();
  });

  it("shows a compact material grid and opens a preview on click", () => {
    renderMaterials(
      [
        {
          id: "m1",
          filename: "cover.jpg",
          mime: "image/jpeg",
          kind: "image",
          ext: "jpg",
          createdAt: "",
          url: "/files/materials/m1.jpg",
        },
        {
          id: "m2",
          filename: "clip.mp4",
          mime: "video/mp4",
          kind: "video",
          ext: "mp4",
          createdAt: "",
          url: "/files/materials/m2.mp4",
        },
      ],
    );
    expect(screen.getByTestId("cutaway-grid").className).toMatch(/grid-cols-5/);
    fireEvent.click(screen.getByRole("button", { name: "预览 cover.jpg" }));
    const imageDialog = screen.getByRole("dialog", { name: "预览 cover.jpg" });
    expect(imageDialog).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "素材预览" })).toHaveAttribute("src", "/files/materials/m1.jpg");
    fireEvent.click(screen.getByRole("button", { name: "关闭" }));
    expect(screen.queryByRole("dialog", { name: "预览 cover.jpg" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "预览 clip.mp4" }));
    expect(screen.getByRole("dialog", { name: "预览 clip.mp4" })).toBeInTheDocument();
    expect(screen.getByLabelText("素材预览")).toHaveAttribute("src", "/files/materials/m2.mp4");
  });

  it("does not open preview when deleting a material", async () => {
    const deleteMaterial = vi.spyOn(api, "deleteMaterial").mockResolvedValue({ ok: true });
    const onMaterialsChange = vi.fn(async () => undefined);
    renderMaterials(
      [
        {
          id: "m1",
          filename: "cover.jpg",
          mime: "image/jpeg",
          kind: "image",
          ext: "jpg",
          createdAt: "",
          url: "/files/materials/m1.jpg",
        },
      ],
      onMaterialsChange,
    );
    fireEvent.click(screen.getByRole("button", { name: "删除 cover.jpg" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await vi.waitFor(() => {
      expect(deleteMaterial).toHaveBeenCalledWith("m1");
    });
    deleteMaterial.mockRestore();
  });

  it("asks to confirm before clearing every visual material", async () => {
    const deleteMaterial = vi.spyOn(api, "deleteMaterial").mockResolvedValue({ ok: true });
    const onMaterialsChange = vi.fn(async () => undefined);
    renderMaterials(
      [
        {
          id: "m1",
          filename: "cover.jpg",
          mime: "image/jpeg",
          kind: "image",
          ext: "jpg",
          createdAt: "",
          url: "/files/materials/m1.jpg",
        },
      ],
      onMaterialsChange,
    );
    fireEvent.click(screen.getByRole("button", { name: "清除全部" }));
    expect(deleteMaterial).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "确认清除" }));
    await vi.waitFor(() => {
      expect(deleteMaterial).toHaveBeenCalledWith("m1");
      expect(onMaterialsChange).toHaveBeenCalled();
    });
    deleteMaterial.mockRestore();
  });
});
