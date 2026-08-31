export function fileUrlToPath(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "file:") return null;
    const decoded = decodeURIComponent(url.pathname);
    if (/^\/[a-zA-Z]:\//.test(decoded)) return decoded.slice(1).replace(/\//g, "\\");
    return decoded;
  } catch {
    return null;
  }
}

export function pathsFromUriList(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map(fileUrlToPath)
    .filter((item): item is string => Boolean(item));
}

export function pathsFromDataTransfer(dataTransfer: DataTransfer | null | undefined): string[] {
  if (!dataTransfer) return [];
  const fromFiles = Array.from(dataTransfer.files).flatMap((file) => {
    const value = (file as File & { path?: string }).path?.trim();
    return value ? [value] : [];
  });
  if (fromFiles.length > 0 && fromFiles.length === dataTransfer.files.length) return fromFiles;
  const fromUri = pathsFromUriList(dataTransfer.getData("text/uri-list") || dataTransfer.getData("text/plain"));
  return fromUri.length > 0 ? fromUri : fromFiles;
}
