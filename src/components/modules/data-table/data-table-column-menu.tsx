"use client";

import { Column } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { ArrowLeftToLine, ArrowRightToLine, EyeOff, PinOff } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface DataTableColumnMenuProps<TData, TValue> {
  column: Column<TData, TValue>;
}

export function DataTableColumnMenu<TData, TValue>({
  column,
}: DataTableColumnMenuProps<TData, TValue>) {
  const t = useTranslations("DataTable");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
          <span className="sr-only">{t("openMenu")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {column.getCanPin() && (
          <>
            <DropdownMenuItem onClick={() => column.pin("left")}>
              <ArrowLeftToLine className="h-4 w-4 me-2" />
              {t("pinLeft")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => column.pin("right")}>
              <ArrowRightToLine className="h-4 w-4 me-2" />
              {t("pinRight")}
            </DropdownMenuItem>
            {column.getIsPinned() && (
              <DropdownMenuItem onClick={() => column.pin(false)}>
                <PinOff className="h-4 w-4 me-2" />
                {t("unpin")}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
          </>
        )}
        {column.getCanHide() && (
          <DropdownMenuItem onClick={() => column.toggleVisibility(false)}>
            <EyeOff className="h-4 w-4 me-2" />
            {t("hideColumn")}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
