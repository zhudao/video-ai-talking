import { readFileSync } from "node:fs";
import path from "node:path";
import { findTemplate, parseTemplates, type TemplateSkin } from "../src/lib/templates.ts";

export function loadTemplates(rootDir = process.cwd()): TemplateSkin[] {
  const file = path.join(rootDir, "templates", "skins.json");
  return parseTemplates(JSON.parse(readFileSync(file, "utf8")) as unknown);
}

export function requireTemplate(id: string, rootDir = process.cwd()): TemplateSkin {
  return findTemplate(loadTemplates(rootDir), id);
}
