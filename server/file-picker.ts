import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { AppError } from "./errors.ts";

const exec = promisify(execFile);

export function normalizePickedPath(raw: string): string | null {
  const trimmed = raw.trim().replace(/\r/g, "").replace(/\/$/, "");
  return trimmed.length > 0 ? trimmed : null;
}

export function splitPickedPaths(raw: string, separator = "\n"): string[] {
  return raw
    .split(separator)
    .map(normalizePickedPath)
    .filter((item): item is string => Boolean(item));
}

export async function pickLocalFiles(): Promise<string[] | null> {
  if (process.platform === "darwin") {
    const { stdout } = await exec("osascript", [
      "-e",
      'try\nset theFiles to choose file with prompt "选择素材文件" with multiple selections allowed\nif class of theFiles is not list then set theFiles to {theFiles}\nset out to ""\nrepeat with f in theFiles\nset out to out & POSIX path of f & linefeed\nend repeat\nreturn out\non error number -128\nreturn ""\nend try',
    ]);
    const paths = splitPickedPaths(stdout);
    return paths.length > 0 ? paths : null;
  }
  if (process.platform === "linux") {
    try {
      const { stdout } = await exec("zenity", ["--file-selection", "--multiple", "--separator=\n", "--title=选择素材文件"]);
      const paths = splitPickedPaths(stdout);
      return paths.length > 0 ? paths : null;
    } catch (error) {
      const err = error as { stdout?: string; stderr?: string; code?: number };
      if (err.code === 1) return null;
      throw new AppError("invalid_material", "当前系统不支持浏览文件，请改用拖入本机文件路径");
    }
  }
  if (process.platform === "win32") {
    const { stdout } = await exec("powershell", [
      "-NoProfile",
      "-Command",
      "Add-Type -AssemblyName System.Windows.Forms; $d = New-Object System.Windows.Forms.OpenFileDialog; $d.Multiselect = $true; $d.Title = '选择素材文件'; if ($d.ShowDialog() -eq 'OK') { $d.FileNames -join \"`n\" }",
    ]);
    const paths = splitPickedPaths(stdout);
    return paths.length > 0 ? paths : null;
  }
  throw new AppError("invalid_material", "当前系统不支持浏览文件");
}
