import type { ReactNode } from "react";
import { type ErrorContext, type ErrorKey, errorCopy } from "../chain/errors.ts";

interface NoticeProps {
  children?: ReactNode;
  tone?: "info" | "warning" | "error" | "success";
  kind?: ErrorKey;
  context?: ErrorContext;
  action?: ReactNode;
}

export function Notice({ children, tone = "info", kind, context, action }: NoticeProps) {
  const copy = kind === undefined ? null : errorCopy(kind, context);
  return (
    <div className={`notice paper notice--${tone}`} role={tone === "error" ? "alert" : "status"}>
      {copy !== null ? (
        <p style={{ marginBottom: action === undefined ? 0 : "var(--space-2)" }}>{copy}</p>
      ) : null}
      {children}
      {action}
    </div>
  );
}
