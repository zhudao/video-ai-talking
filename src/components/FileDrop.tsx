import { useState } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/cn";
import { pathsFromDataTransfer } from "@/lib/local-paths";
import { Button } from "./ui";

export function FileDrop({
  label,
  hint,
  onBrowse,
  onLinkPaths,
  onMissingPaths,
  busy,
}: {
  accept?: string;
  multiple?: boolean;
  label: string;
  hint: string;
  onBrowse?: () => void;
  onLinkPaths?: (paths: string[]) => void;
  onMissingPaths?: () => void;
  busy?: boolean;
}) {
  const [over, setOver] = useState(false);

  return (
    <div
      className={cn(
        "flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 px-3 py-5 text-center transition-colors",
        over && !busy && "bg-muted/40",
        busy && "opacity-90",
      )}
      onDragOver={(event) => {
        event.preventDefault();
        if (!busy) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        if (busy) return;
        const paths = pathsFromDataTransfer(event.dataTransfer);
        if (paths.length > 0) {
          onLinkPaths?.(paths);
          return;
        }
        onMissingPaths?.();
      }}
    >
      <Upload className="size-4 text-muted-foreground" />
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{busy ? "正在添加素材…" : hint}</p>
      </div>
      <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={onBrowse}>
        {busy ? "添加中…" : "选择文件"}
      </Button>
    </div>
  );
}
