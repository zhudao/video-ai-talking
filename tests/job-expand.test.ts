import { describe, expect, it } from "vitest";
import {
  cuesFromScript,
  expandJob,
  JobExpandError,
  splitBodyByNewlines,
  splitBodyToCaptions,
} from "../src/lib/job-expand";

const scripts = [
  { title: "标题一", body: "正文一" },
  { title: "标题二", body: "正文二" },
];

describe("expandJob", () => {
  it("keeps only the first complete script and first template", () => {
    const rows = expandJob({
      scripts,
      templateIds: ["red-bold", "plain-white"],
      referenceVideoId: "ref-1",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      script: { title: "标题一", body: "正文一" },
      templateId: "red-bold",
      referenceVideoId: "ref-1",
    });
  });

  it("throws invalid_reference when the talking-head video is missing", () => {
    expect(() =>
      expandJob({
        scripts: [{ title: "有标题", body: "有正文" }],
        templateIds: ["red-bold"],
        referenceVideoId: "",
      }),
    ).toThrow(JobExpandError);
    try {
      expandJob({
        scripts: [{ title: "有标题", body: "有正文" }],
        templateIds: ["red-bold"],
        referenceVideoId: "",
      });
    } catch (error) {
      expect(error).toMatchObject({ code: "invalid_reference" });
    }
  });

  it("keeps title-less scripts when title overlay is off", () => {
    const rows = expandJob({
      scripts: [{ title: "", body: "只有口播" }],
      templateIds: ["red-bold"],
      referenceVideoId: "ref-1",
      requireTitle: false,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.script.body).toBe("只有口播");
  });

  it("ignores incomplete scripts", () => {
    const rows = expandJob({
      scripts: [
        { title: "", body: "no title" },
        { title: "有标题", body: "有正文" },
      ],
      templateIds: ["red-bold"],
      referenceVideoId: "ref-1",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.script.title).toBe("有标题");
  });

  it("splits spoken text into subtitle cues", () => {
    const captions = splitBodyToCaptions("先把抽屉分区。再把锅具立起来。");
    expect(captions).toHaveLength(2);
    const cues = cuesFromScript(
      { title: "收纳", body: "", captions },
      2000,
    );
    expect(cues.map((item) => item.text)).toEqual(["先把抽屉分区。", "再把锅具立起来。"]);
    expect(cues[0]?.endMs).toBeLessThan(cues[1]?.endMs ?? 0);
    expect(cues[1]?.endMs).toBe(2000);
  });

  it("times long comma-separated copy by spoken length instead of one full-screen line", () => {
    const cues = cuesFromScript(
      { title: "营销云", body: "营销云，就是把所有营销环节整合到一起的超级工具" },
      34000,
    );
    expect(cues.length).toBeGreaterThan(1);
    expect(cues[0]?.text).toContain("营销云");
    expect(cues[0]?.endMs).toBeLessThan(20000);
    expect(cues.at(-1)?.endMs).toBe(34000);
    const firstShare = (cues[0]?.endMs ?? 0) - (cues[0]?.startMs ?? 0);
    const lastShare = (cues.at(-1)?.endMs ?? 0) - (cues.at(-1)?.startMs ?? 0);
    expect(lastShare).toBeGreaterThan(firstShare);
  });

  it("splits custom copy by newlines only", () => {
    expect(splitBodyByNewlines("先把抽屉分区。再把锅具立起来。\n周末到店有福利").map((item) => item.text)).toEqual([
      "先把抽屉分区。再把锅具立起来。",
      "周末到店有福利",
    ]);
  });
});

