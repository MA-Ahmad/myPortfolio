import { cn } from "@/lib/utils";

export function Panel({
  className,
  children,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "screen-line-top screen-line-bottom border-x border-line",
        className
      )}
      {...props}
    >
      {children}
    </section>
  );
}

export function PanelHeader({
  className,
  ...props
}: React.ComponentProps<"header">) {
  return (
    <header
      className={cn("screen-line-bottom px-4", className)}
      {...props}
    />
  );
}

export function PanelTitle({
  className,
  children,
  count,
  ...props
}: React.ComponentProps<"h2"> & { count?: number }) {
  return (
    <h2
      className={cn(
        "text-3xl font-medium tracking-tight text-balance",
        className
      )}
      {...props}
    >
      {children}
      {count !== undefined && (
        <sup className="top-[-0.75em] ml-1 text-sm font-medium tracking-normal text-muted-foreground">
          ({count})
        </sup>
      )}
    </h2>
  );
}

export function PanelContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div className={cn("p-4", className)} {...props} />;
}
