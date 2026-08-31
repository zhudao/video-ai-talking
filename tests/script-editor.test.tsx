import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ScriptSection } from "../src/components/ComposeForm";
import { EMPTY_CONFIG } from "../src/lib/config";
import { newCaptionId, type JobScript } from "../src/lib/job-expand";
import { api, type Material } from "../src/lib/api";

const coffee: Material = {
  id: "m-coffee",
  filename: "coffee.jpg",
  mime: "image/jpeg",
  kind: "image",
  ext: "jpg",
  createdAt: "",
  url: "/files/materials/m-coffee.jpg",
};

const face: Material = {
  id: "ref-face",
  filename: "face.mp4",
  mime: "video/mp4",
  kind: "video",
  ext: "mp4",
  createdAt: "",
  url: "/files/materials/face.mp4",
};

function Editor({
  initial = [
    {
      title: "周末亲子",
      body: "先看环境。再看课程。",
      captions: [
        { id: newCaptionId(), text: "先看环境。再看课程。" },
        { id: "cap-2", text: "到店还有亲子福利。" },
      ],
    },
  ],
  materials = [],
  reference = null,
}: {
  initial?: JobScript[];
  materials?: Material[];
  reference?: Material | null;
}) {
  const [scripts, setScripts] = useState<JobScript[]>(initial);
  return (
    <ScriptSection
      config={EMPTY_CONFIG}
      scripts={scripts}
      materials={materials}
      reference={reference}
      onScriptsChange={setScripts}
    />
  );
}

describe("ScriptSection editor", () => {
  it("edits the single script inline without a table or popover", () => {
    render(<Editor />);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /编辑文案/ })).not.toBeInTheDocument();

    const title = screen.getByRole("textbox", { name: "口播标题" });
    expect(title).toHaveValue("周末亲子");
    fireEvent.change(title, { target: { value: "修改后的标题" } });
    expect(title).toHaveValue("修改后的标题");

    expect(screen.getByRole("textbox", { name: "字幕 1" })).toHaveValue("先看环境。再看课程。");
    expect(screen.getByRole("textbox", { name: "字幕 2" })).toHaveValue("到店还有亲子福利。");
    expect(screen.getByRole("button", { name: "字幕 1 画面：请补充口播真人视频" })).toHaveTextContent(
      "请补充口播真人视频",
    );
    expect(screen.queryByLabelText("口播真人预览")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("字幕 1 选画面")).not.toBeInTheDocument();
  });

  it("previews the selected talking-head video on face captions", () => {
    render(<Editor reference={face} />);
    const cell = screen.getByRole("button", { name: "字幕 1 画面：口播真人" });
    const preview = within(cell).getByLabelText("口播真人预览");
    expect(preview.tagName).toBe("VIDEO");
    expect(preview).toHaveAttribute("src", "/files/materials/face.mp4");
    expect(cell).toHaveTextContent("口播真人");
    expect(cell).not.toHaveTextContent("请补充口播真人视频");
    expect(cell).not.toHaveTextContent("默认·口播真人");
  });

  it("keeps AI generate and manual fill mutually exclusive", () => {
    render(<Editor initial={[]} />);
    expect(screen.getByRole("textbox", { name: "生成主题" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "完整文案" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "口播标题" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "手动填写" }));
    expect(screen.queryByRole("textbox", { name: "生成主题" })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "完整文案" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "口播标题" })).toBeInTheDocument();
  });

  it("splits pasted copy into caption rows in place", () => {
    render(<Editor initial={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "手动填写" }));
    fireEvent.change(screen.getByRole("textbox", { name: "口播标题" }), {
      target: { value: "周末亲子" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "完整文案" }), {
      target: { value: "先看环境。再看课程。\n到店还有亲子福利。" },
    });
    fireEvent.click(screen.getByRole("button", { name: "拆成字幕" }));
    expect(screen.getByRole("textbox", { name: "字幕 1" })).toHaveValue("先看环境。再看课程。");
    expect(screen.getByRole("textbox", { name: "字幕 2" })).toHaveValue("到店还有亲子福利。");
    expect(screen.getByRole("textbox", { name: "口播标题" })).toHaveValue("周末亲子");
  });

  it("picks a cutaway from the visual shot grid", () => {
    render(<Editor materials={[coffee]} />);
    expect(screen.getByRole("button", { name: "字幕 2 画面：请补充口播真人视频" })).toHaveTextContent(
      "请补充口播真人视频",
    );
    fireEvent.click(screen.getByRole("button", { name: "字幕 2 画面：请补充口播真人视频" }));
    fireEvent.click(within(screen.getByLabelText("字幕 2 选画面")).getByRole("option", { name: "选用 coffee.jpg" }));
    expect(screen.getByRole("button", { name: "字幕 2 画面：coffee.jpg" })).toHaveTextContent("素材·coffee.jpg");
    expect(screen.queryByLabelText("字幕 2 选画面")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "字幕 1 画面：请补充口播真人视频" })).toHaveTextContent(
      "请补充口播真人视频",
    );
  });

  it("assigns a dragged b-roll thumbnail to a caption", () => {
    render(<Editor materials={[coffee]} />);
    fireEvent.drop(screen.getByRole("textbox", { name: "字幕 1" }).closest("li")!, {
      dataTransfer: {
        getData: (type: string) => (type === "application/x-vat-material" ? coffee.id : ""),
        types: ["application/x-vat-material"],
      },
    });
    expect(screen.getByRole("button", { name: "字幕 1 画面：coffee.jpg" })).toHaveTextContent("素材·coffee.jpg");
  });

  it("lets the user pick a spoken duration and sends it when generating", async () => {
    const generateScripts = vi.spyOn(api, "generateScripts").mockResolvedValue({
      scripts: [{ title: "周末到店", body: "先看环境。" }],
    });
    const onConfigChange = vi.fn();
    render(
      <ScriptSection
        config={{ ...EMPTY_CONFIG, apiKey: "sk-test", scriptDurationSec: 30 }}
        scripts={[]}
        onScriptsChange={() => undefined}
        onConfigChange={onConfigChange}
      />,
    );
    expect(screen.getByRole("radio", { name: "30秒" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("radio", { name: "15秒" }));
    expect(onConfigChange).toHaveBeenCalledWith(expect.objectContaining({ scriptDurationSec: 15 }));

    fireEvent.change(screen.getByRole("textbox", { name: "生成主题" }), { target: { value: "周末亲子" } });
    fireEvent.click(screen.getByRole("button", { name: "生成这一条" }));
    await vi.waitFor(() => {
      expect(generateScripts).toHaveBeenCalledWith({
        apiKey: "sk-test",
        topic: "周末亲子",
        count: 1,
        durationSec: 15,
      });
    });
    generateScripts.mockRestore();
  });

  it("accepts a custom duration in seconds", async () => {
    const generateScripts = vi.spyOn(api, "generateScripts").mockResolvedValue({
      scripts: [{ title: "周末到店", body: "先看环境。" }],
    });
    const onConfigChange = vi.fn();
    render(
      <ScriptSection
        config={{ ...EMPTY_CONFIG, apiKey: "sk-test", scriptDurationSec: 30 }}
        scripts={[]}
        onScriptsChange={() => undefined}
        onConfigChange={onConfigChange}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "自定义" }));
    const custom = screen.getByRole("spinbutton", { name: "自定义秒数" });
    fireEvent.change(custom, { target: { value: "20" } });
    fireEvent.blur(custom);
    expect(onConfigChange).toHaveBeenCalledWith(expect.objectContaining({ scriptDurationSec: 20 }));

    fireEvent.change(screen.getByRole("textbox", { name: "生成主题" }), { target: { value: "周末亲子" } });
    fireEvent.click(screen.getByRole("button", { name: "生成这一条" }));
    await vi.waitFor(() => {
      expect(generateScripts).toHaveBeenCalledWith({
        apiKey: "sk-test",
        topic: "周末亲子",
        count: 1,
        durationSec: 20,
      });
    });
    generateScripts.mockRestore();
  });
});
