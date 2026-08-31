import type { ReactNode, Ref } from "react";
import { cn } from "@/lib/cn";

export function WorkflowPanel({
  step,
  title,
  description,
  children,
  panelRef,
  highlighted = false,
  className,
}: {
  step?: string;
  title: string;
  description: string;
  children: ReactNode;
  panelRef?: Ref<HTMLElement>;
  highlighted?: boolean;
  className?: string;
}) {
  return (
    <section
      ref={panelRef}
      aria-label={title}
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)] border-l-4 border-l-primary transition-colors duration-200",
        highlighted && "border-l-primary bg-primary/10 shadow-lg",
        className,
      )}
    >
      <div className="shrink-0 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">
            {step ? <span className="mr-1.5 text-muted-foreground">{step}</span> : null}
            {title}
          </h3>
          <p className="mt-1 text-xs leading-4 text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
    </section>
  );
}
