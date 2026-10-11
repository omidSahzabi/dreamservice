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
  PENDING: {
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  },
  PROCESSING: {
    className: "bg-primary/10 text-primary border-primary/20",
  },
  COMPLETED: {
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  },
  CANCELLED: {
    className: "bg-surface-2 text-text-muted border-border-soft",
  },
  REJECTED: {
    className: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
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
