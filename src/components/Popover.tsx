import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

const VIEWPORT_PADDING = 8;
const GAP = 4;

export function Popover({
  trigger,
  title,
  description,
  children,
  className,
}: {
  trigger: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  function place() {
    const triggerEl = triggerRef.current;
    const panel = panelRef.current;
    if (!triggerEl || !panel) return;
    const rect = triggerEl.getBoundingClientRect();
    const panelWidth = panel.offsetWidth;
    const panelHeight = panel.offsetHeight;
    const maxLeft = window.innerWidth - VIEWPORT_PADDING - panelWidth;
    const left = Math.max(VIEWPORT_PADDING, Math.min(rect.right - panelWidth, maxLeft));
    const below = rect.bottom + GAP;
    const above = rect.top - GAP - panelHeight;
    const fitsBelow = below + panelHeight <= window.innerHeight - VIEWPORT_PADDING;
    const top = fitsBelow ? below : Math.max(VIEWPORT_PADDING, above);
    setCoords({ top, left });
  }

  useLayoutEffect(() => {
    if (!open) return;
    place();
    const panel = panelRef.current;
    if (!panel || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => place());
    observer.observe(panel);
    return () => observer.disconnect();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onReposition() {
      place();
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open]);

  return (
    <>
      <span ref={triggerRef} className="inline-flex" onClick={() => setOpen((value) => !value)}>
        {trigger}
      </span>
      {open
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-labelledby={titleId}
              style={{ top: coords.top, left: coords.left }}
              className={cn(
                "fixed z-50 max-h-[min(32rem,calc(100vh-1rem))] w-[min(22rem,calc(100vw-2rem))] space-y-3 overflow-y-auto rounded-xl border border-border bg-card p-3 shadow-[var(--shadow-card)]",
                className,
              )}
            >
              <div>
                <p id={titleId} className="text-sm font-semibold">
                  {title}
                </p>
                {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
              </div>
              {children}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
