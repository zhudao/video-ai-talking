import { serve } from "@hono/node-server";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.ts";
import { createRunner } from "./jobs/runner.ts";
import { logInfo } from "./log.ts";
import { isMockMode, mockAppOverrides, mockRunnerOverrides } from "./mock-mode.ts";
import { createStore } from "./store.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(here, "..");
export const dataRoot = process.env.QM_DATA_DIR || path.join(projectRoot, "data");
export const store = createStore(dataRoot);
const mocked = isMockMode();
export const runner = createRunner({
  store,
  projectRoot,
  ...(mocked ? mockRunnerOverrides() : {}),
});
export const app = createApp({
  store,
  runner,
  projectRoot,
  ...(mocked ? mockAppOverrides() : {}),
});

const thisFile = fileURLToPath(import.meta.url);
const invoked = process.argv[1] ? path.resolve(process.argv[1]) : "";
const isMain = invoked === thisFile || invoked.endsWith(`${path.sep}server${path.sep}index.ts`);

if (isMain) {
  const port = Number(process.env.PORT || 8789);
  await store.ensureDirs();
  await store.failInterruptedJobs();
  logInfo(
    `listening on 127.0.0.1:${port}（开发用 npm run dev 打开 5175；生产先 npm run build，再访问本地址）${mocked ? "；VAT_MOCK=1 已启用" : ""}`,
  );
  serve({ fetch: app.fetch, port, hostname: "127.0.0.1" });
}
