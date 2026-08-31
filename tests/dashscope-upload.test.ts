import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DASHSCOPE_UPLOAD_POLICY_URL,
  uploadLocalFileToDashscope,
} from "../server/upload/dashscope.ts";

describe("dashscope temp upload", () => {
  it("posts the local file to the official host and returns oss://", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "vat-up-"));
    const filePath = path.join(dir, "ref.mp4");
    await writeFile(filePath, "video-bytes");
    const urls: string[] = [];
    const oss = await uploadLocalFileToDashscope({
      apiKey: "sk-test",
      filePath,
      fetchImpl: async (url, init) => {
        urls.push(String(url));
        if (String(url).startsWith(DASHSCOPE_UPLOAD_POLICY_URL)) {
          return new Response(
            JSON.stringify({
              data: {
                upload_dir: "dashscope-instant/tmp",
                upload_host: "https://upload.example.com",
                oss_access_key_id: "id",
                signature: "sig",
                policy: "pol",
                x_oss_object_acl: "private",
                x_oss_forbid_overwrite: "true",
              },
            }),
            { status: 200 },
          );
        }
        expect(init?.method).toBe("POST");
        expect(init?.body).toBeInstanceOf(FormData);
        const form = init?.body as FormData;
        expect(form.get("key")).toBe("dashscope-instant/tmp/ref.mp4");
        expect(form.get("file")).toBeTruthy();
        return new Response("", { status: 200 });
      },
    });
    expect(oss).toBe("oss://dashscope-instant/tmp/ref.mp4");
    expect(urls[0]).toContain("action=getPolicy");
    expect(urls[0]).toContain("model=videoretalk");
    expect(urls[1]).toBe("https://upload.example.com");
  });
});
