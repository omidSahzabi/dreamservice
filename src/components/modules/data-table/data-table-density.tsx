"use client";

import { useTranslations } from "next-intl";
import { AlignJustify, List, Rows } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DensityState } from "./data-table-types";

export const densityRowClasses: Record<DensityState, string> = {
  compact: "h-8",
  default: "h-12",
  comfortable: "h-16",
};

export const densityCellClasses: Record<DensityState, string> = {
  compact: "py-1 px-2 text-xs",
  default: "py-2 px-3 text-sm",
  comfortable: "py-4 px-4 text-base",
};

interface DataTableDensityProps {
  density: DensityState;
  onDensityChange: (density: DensityState) => void;
}

export function DataTableDensity({
  density,
  onDensityChange,
}: DataTableDensityProps) {
  const t = useTranslations("DataTable");

  const options: { value: DensityState; labelKey: "compact" | "default" | "comfortable"; icon: typeof List }[] = [
    { value: "compact", labelKey: "compact", icon: Rows },
    { value: "default", labelKey: "default", icon: List },
    { value: "comfortable", labelKey: "comfortable", icon: AlignJustify },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-2">
          <List className="h-4 w-4" />
          <span>{t("density")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {options.map(({ value, labelKey, icon: Icon }) => (
          <DropdownMenuItem
            key={value}
            onClick={() => onDensityChange(value)}
            className={density === value ? "bg-accent font-semibold" : ""}
          >
            <Icon className="h-4 w-4 me-2" />
            {t(labelKey)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
