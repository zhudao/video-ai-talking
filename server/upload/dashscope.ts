import { readFile } from "node:fs/promises";
import path from "node:path";
import { AppError } from "../errors.ts";

export const DASHSCOPE_UPLOAD_POLICY_URL = "https://dashscope.aliyuncs.com/api/v1/uploads";
export const VIDEORETALK_MODEL = "videoretalk";

type FetchLike = typeof fetch;

export type UploadPolicy = {
  upload_dir: string;
  upload_host: string;
  oss_access_key_id: string;
  signature: string;
  policy: string;
  x_oss_object_acl: string;
  x_oss_forbid_overwrite: string;
};

export function ossUrlFromKey(key: string): string {
  return `oss://${key.replace(/^\/+/, "")}`;
}

export async function getDashscopeUploadPolicy(
  apiKey: string,
  model = VIDEORETALK_MODEL,
  fetchImpl: FetchLike = fetch,
): Promise<UploadPolicy> {
  const key = apiKey.trim();
  if (!key) throw new AppError("upload_failed", "请填写阿里百炼 API Key");
  const url = new URL(DASHSCOPE_UPLOAD_POLICY_URL);
  url.searchParams.set("action", "getPolicy");
  url.searchParams.set("model", model);
  const res = await fetchImpl(url, {
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    throw new AppError("upload_failed", `获取百炼上传凭证失败（HTTP ${res.status}）`);
  }
  const body = (await res.json()) as { data?: UploadPolicy };
  if (!body.data?.upload_host || !body.data.upload_dir) {
    throw new AppError("upload_failed", "百炼上传凭证不完整");
  }
  return body.data;
}

export async function uploadLocalFileToDashscope(input: {
  apiKey: string;
  filePath: string;
  model?: string;
  fetchImpl?: FetchLike;
}): Promise<string> {
  const policy = await getDashscopeUploadPolicy(input.apiKey, input.model, input.fetchImpl);
  const fileName = path.basename(input.filePath);
  const key = `${policy.upload_dir}/${fileName}`;
  const form = new FormData();
  form.set("OSSAccessKeyId", policy.oss_access_key_id);
  form.set("Signature", policy.signature);
  form.set("policy", policy.policy);
  form.set("x-oss-object-acl", policy.x_oss_object_acl);
  form.set("x-oss-forbid-overwrite", policy.x_oss_forbid_overwrite);
  form.set("key", key);
  form.set("success_action_status", "200");
  const bytes = await readFile(input.filePath);
  form.set("file", new Blob([bytes]), fileName);
  const res = await (input.fetchImpl ?? fetch)(policy.upload_host, { method: "POST", body: form });
  if (!res.ok) {
    throw new AppError("upload_failed", `上传到百炼临时存储失败（HTTP ${res.status}）`);
  }
  return ossUrlFromKey(key);
}
