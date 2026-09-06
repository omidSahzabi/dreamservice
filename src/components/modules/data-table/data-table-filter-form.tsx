"use client"

import type { DataTableFilterField, DataTableFilterValues } from "./data-table-filter-types"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type Props = {
  fields: DataTableFilterField[]
  values: DataTableFilterValues
  onChange: (values: DataTableFilterValues) => void
}

export function DataTableFilterForm({
  fields,
  values,
  onChange,
}: Props) {
  const updateValue = (id: string, value: string) => {
    onChange({
      ...values,
      [id]: value,
    })
  }

  return (
    <div className="flex w-full flex-wrap items-end gap-3">
      {fields.map((field) => (
        <div
          key={field.id}
          className="min-w-[180px] flex-1 space-y-1.5"
        >
          <label className="text-xs font-medium text-white/60">
            {field.label}
          </label>

          {field.type === "text" ? (
            <Input
              value={values[field.id] ?? ""}
              placeholder={field.placeholder}
              onChange={(event) =>
                updateValue(field.id, event.target.value)
              }
              className="h-9 border-white/10 bg-[#101C44] text-xs text-white placeholder:text-white/40"
            />
          ) : (
            <Select
  value={values[field.id] ?? ""}
  onValueChange={(value) => updateValue(field.id, value)}
>
  <SelectTrigger
    size="sm"
    className="h-8 w-full min-w-[180px] border-white/10 bg-[#101C44] text-xs text-white hover:bg-[#162653]"
  >
    <SelectValue placeholder={field.placeholder} />
  </SelectTrigger>

  <SelectContent
    position="popper"
    align="start"
    className="z-[100] min-w-[180px] border border-white/10 bg-[#0C1633] text-white shadow-xl"
  >
    {field.options?.map((option) => (
      <SelectItem
        key={option.value}
        value={option.value}
        className="cursor-pointer text-xs text-white focus:bg-[#101C44] focus:text-white"
      >
        {option.label}
      </SelectItem>
    ))}
  </SelectContent>
</Select>

          )}
        </div>
      ))}
    </div>
  )
}
