import * as React from "react"
import { cn } from "@/lib/utils"

interface SectionCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode
}

export function SectionCard({ title, className, children, ...props }: SectionCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-white p-6 shadow-[0_4px_16px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.03)]",
        className,
      )}
      {...props}
    >
      {title && <h2 className="mb-4 text-base font-semibold text-[#2D3748]">{title}</h2>}
      {children}
    </div>
  )
}
