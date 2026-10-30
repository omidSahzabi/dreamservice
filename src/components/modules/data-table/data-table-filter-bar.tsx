"use client";

import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface DataTableFilterBarProps {
  filterValues?: Record<string, unknown>;
  onClearFilters?: () => void;
  children: React.ReactNode;
}

export function DataTableFilterBar({
  filterValues,
  onClearFilters,
  children,
}: DataTableFilterBarProps) {
  const format = useFormatter();
  const t = useTranslations("DataTable");
  const [isOpen, setIsOpen] = React.useState(false);

  const activeFiltersCount = React.useMemo(() => {
    if (!filterValues) return 0;
    return Object.values(filterValues).filter(
      (v) => v !== undefined && v !== "" && v !== null
    ).length;
  }, [filterValues]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
          className="h-8 gap-2"
        >
          <Filter className="h-4 w-4" />
          <span>{t("filters")}</span>
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="px-1.5 py-0.5 text-xs">
              {format.number(activeFiltersCount)}
            </Badge>
          )}
        </Button>

        {activeFiltersCount > 0 && onClearFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="h-8 gap-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
            <span>{t("clear")}</span>
          </Button>
        )}
      </div>

      {isOpen && (
        <div className="p-4 rounded-lg border border-border/40 bg-card/50">
          {children}
        </div>
      )}
    </div>
  );
}
