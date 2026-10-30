"use client";
import {useTranslations} from "next-intl";
import { OrderStatus } from "../types";

interface Props {
  status: string | null;
}

const statusConfig: Record<
  OrderStatus,
  { className: string }
> = {
  NEGOTIATING: {className: "bg-primary/10 text-primary border-primary/20"},
  PENDING: {
    className: "bg-warning/10 text-warning border-warning/25",
  },
  PROCESSING: {
    className: "bg-primary/10 text-primary border-primary/20",
  },
  COMPLETED: {
    className: "bg-success/10 text-success border-success/25",
  },
  CANCELLED: {
    className: "bg-surface-2 text-text-muted border-border-soft",
  },
  REJECTED: {
    className: "bg-destructive/10 text-destructive border-destructive/25",
  },
};

export function OrderStatusBadge({ status }: Props) {
  const t = useTranslations("OrderStatus");
  const common = useTranslations("Common");
  const knownStatus = Object.keys(statusConfig).find((value): value is OrderStatus => value === status);
  const config = knownStatus ? statusConfig[knownStatus] : {
    className: "bg-surface-2 text-text-muted border-border-soft",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-colors ${config.className}`}
    >
      {knownStatus ? t(knownStatus) : common("unknown")}
    </span>
  );
}
