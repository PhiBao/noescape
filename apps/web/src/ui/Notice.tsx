import type { ReactNode } from "react";

interface NoticeProps {
  children: ReactNode;
  tone?: "info" | "warning" | "error" | "success";
}

export function Notice({ children, tone = "info" }: NoticeProps) {
  return (
    <div className={`notice paper notice--${tone}`} role={tone === "error" ? "alert" : "status"}>
      {children}
    </div>
  );
}
