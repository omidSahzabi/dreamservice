"use client";

import {useTranslations} from "next-intl";
import {
  Download,
} from "lucide-react";

import type {
  Table,
} from "@tanstack/react-table";

import {
  Button,
} from "@/components/ui/button";

import {
  downloadCSV,
} from "./data-table-utils";

interface Props<TData> {
  table: Table<TData>;
  filename?: string;
}

export function DataTableExport<TData>({
  table,
  filename = "data.csv",
}: Props<TData>) {
  const t = useTranslations("DataTable");
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8"
      onClick={() =>
        downloadCSV(
          table,
          filename,
        )
      }
    >
      <Download className="me-2 h-4 w-4" />
      {t("export")}
    </Button>
  );
}