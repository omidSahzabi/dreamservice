import { OrderStatus } from "../types";

interface Props {
  status: OrderStatus;
}

const statusConfig: Record<
  OrderStatus,
  { label: string; className: string }
> = {
  PENDING: {
    label: "در انتظار بررسی",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  },
  PROCESSING: {
    label: "در حال پردازش",
    className: "bg-primary/10 text-primary border-primary/20",
  },
  COMPLETED: {
    label: "تکمیل شده",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  },
  CANCELLED: {
    label: "لغو شده",
    className: "bg-surface-2 text-text-muted border-border-soft",
  },
  REJECTED: {
    label: "رد شده",
    className: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  },
};

export function OrderStatusBadge({ status }: Props) {
  const config = statusConfig[status] ?? {
    label: status,
    className: "bg-surface-2 text-text-muted border-border-soft",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-colors ${config.className}`}
    >
      {config.label}
    </span>
  );
}
