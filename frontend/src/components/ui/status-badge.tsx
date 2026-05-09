import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type Status = "active" | "inactive" | "passed" | "failed" | "running" | "stopped" | (string & {})
type Size = "sm" | "default"

const statusConfig: Record<string, { className?: string; variant?: "destructive" | "secondary" | "default" }> = {
  active: { variant: "default" },
  inactive: { variant: "secondary" },
  passed: { className: "bg-green-100 text-green-800 hover:bg-green-100" },
  failed: { variant: "destructive" },
  running: { className: "bg-blue-100 text-blue-800 hover:bg-blue-100" },
  stopped: { variant: "secondary" },
}

export function StatusBadge({ status, size = "default" }: { status: Status; size?: Size }) {
  const label = status.charAt(0).toUpperCase() + status.slice(1)
  const config = statusConfig[status] ?? { variant: "secondary" as const }

  return (
    <Badge
      variant={config.variant}
      className={cn(config.className, size === "sm" && "text-xs")}
    >
      {label}
    </Badge>
  )
}
