"use client"
import { useState } from "react"
import { ChevronDown, Filter, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DataTableFilterForm } from "./data-table-filter-form"
import type {
  DataTableFilterField,
  DataTableFilterValues,
} from "./data-table-filter-types"

type Props = {
  fields: DataTableFilterField[]
  values: DataTableFilterValues
  onChange: (values: DataTableFilterValues) => void
}

export function DataTableFilterBar({
  fields,
  values,
  onChange,
}: Props) {
  const [isOpen, setIsOpen] = useState(false)

  const activeCount = Object.values(values).filter(Boolean).length

  const clearFilters = () => {
    onChange({})
  }

  return (
    <div className="w-full">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsOpen((current) => !current)}
          className="h-8 gap-2 border-white/10 bg-[#0C1633] text-xs text-white/80 hover:bg-[#101C44] hover:text-white"
        >
          <Filter className="size-4" />

          <span>فیلترها</span>

          {activeCount > 0 && (
            <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
              {activeCount}
            </span>
          )}

          <ChevronDown
            className={`size-3.5 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </Button>

        {activeCount > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-8 gap-1.5 text-xs text-white/60 hover:bg-white/5 hover:text-white"
          >
            <X className="size-3.5" />
            پاک کردن
          </Button>
        )}
      </div>

      {isOpen && (
        <div className="mt-3 w-full border-y border-white/10 bg-[#0C1633]/70 px-3 py-3">
          <DataTableFilterForm
            fields={fields}
            values={values}
            onChange={onChange}
          />
        </div>
      )}
    </div>
  )
}
