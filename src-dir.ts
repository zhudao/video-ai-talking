import { fileURLToPath } from "node:url";

export function resolveSrcDir(importMetaUrl: string): string {
  return fileURLToPath(new URL("./src", importMetaUrl));
}
