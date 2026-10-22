"use client"

import * as React from "react"
import { TableCell, TableRow } from "@/components/ui/table"

const SKELETON_WIDTHS = ["w-16", "w-24", "w-20", "w-28", "w-14"]

type Props = {
  rows: number
  columns: number
}

export function DataTableSkeleton({ rows, columns }: Props) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <TableRow
          key={`skeleton-row-${rowIndex}`}
          className="border-border hover:bg-transparent"
        >
          {Array.from({ length: columns }).map((__, columnIndex) => {
            const width =
              SKELETON_WIDTHS[(rowIndex + columnIndex) % SKELETON_WIDTHS.length]

            return (
              <TableCell
                key={`skeleton-cell-${rowIndex}-${columnIndex}`}
                className="h-[74px] px-4 py-3"
              >
                <div
                  className={`h-3 ${width} max-w-full animate-pulse rounded-sm bg-muted`}
                />
              </TableCell>
            )
          })}
        </TableRow>
      ))}
    </>
  )
}
