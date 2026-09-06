"use client";

import * as React from "react";

import {
  Check,
  Filter,
  X,
} from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";


import {
  Button,
} from "@/components/ui/button";

import {
  Input,
} from "@/components/ui/input";

import {
  Label,
} from "@/components/ui/label";

import {
  Checkbox,
} from "@/components/ui/checkbox";

import type {
  DataTableFilterConfig,
  DataTableFilters,
} from "./data-table-types";

interface Props {
  config: DataTableFilterConfig[];

  value: DataTableFilters;

  onChange: (
    filters: DataTableFilters,
  ) => void;
}

export function DataTableFilters({
  config,
  value,
  onChange,
}: Props) {
  const [open, setOpen] =
    React.useState(false);

  const [activeKey, setActiveKey] =
    React.useState<string | null>(null);

  const activeFilter =
    config.find(
      (item) => item.key === activeKey,
    );

  const activeFilterCount =
    Object.values(value).filter(
      (item) =>
        item !== undefined &&
        item !== null &&
        String(item).trim() !== "",
    ).length;

  const updateFilter = (
    key: string,
    filterValue:
      | string
      | number
      | undefined,
  ) => {
    const nextFilters = {
      ...value,
    };

    if (
      filterValue === undefined ||
      filterValue === "" ||
      filterValue === null
    ) {
      delete nextFilters[key];
    } else {
      nextFilters[key] = filterValue;
    }

    onChange(nextFilters);
  };

  const clearFilter = (
    key: string,
  ) => {
    const nextFilters = {
      ...value,
    };

    delete nextFilters[key];

    onChange(nextFilters);
  };

  const clearAll = () => {
    onChange({});
    setActiveKey(null);
  };

  return (
    <div className="flex items-center gap-2">
      <Popover
        open={open}
        onOpenChange={setOpen}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-2 border-white/10 bg-[#0C1633] text-xs text-white/80 hover:bg-[#101C44] hover:text-white"
          >
            <Filter className="size-3.5" />

            <span>فیلتر</span>

            {activeFilterCount > 0 && (
              <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          className="w-[360px] border-white/10 bg-[#0C1633] p-0 text-white"
        >
          <div className="flex min-h-[280px]">
            {/* Filter keys */}
            <div className="w-[140px] border-r border-white/10 p-2">
              <div className="px-2 py-2 text-[11px] font-semibold text-white/40">
                فیلترها
              </div>

              <div className="space-y-1">
                {config.map((filter) => {
                  const isActive =
                    activeKey === filter.key;

                  const hasValue =
                    value[filter.key] !==
                      undefined &&
                    value[filter.key] !== "";

                  return (
                    <button
                      key={filter.key}
                      type="button"
                      onClick={() =>
                        setActiveKey(
                          filter.key,
                        )
                      }
                      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-right text-xs transition-colors ${
                        isActive
                          ? "bg-primary/15 text-primary"
                          : "text-white/70 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <span>
                        {filter.label}
                      </span>

                      {hasValue && (
                        <span className="size-1.5 rounded-full bg-primary" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Filter form */}
            <div className="flex-1 p-4">
              {!activeFilter ? (
                <div className="flex h-full min-h-[240px] items-center justify-center text-center text-xs text-white/40">
                  <div className="space-y-2">
                    <Filter className="mx-auto size-5 opacity-50" />

                    <p>
                      یک فیلتر را انتخاب کنید
                    </p>
                  </div>
                </div>
              ) : (
                <FilterField
                  filter={activeFilter}
                  value={
                    value[
                      activeFilter.key
                    ]
                  }
                  onChange={(nextValue) =>
                    updateFilter(
                      activeFilter.key,
                      nextValue,
                    )
                  }
                  onClear={() =>
                    clearFilter(
                      activeFilter.key,
                    )
                  }
                />
              )}
            </div>
          </div>

          {activeFilterCount > 0 && (
            <div className="flex items-center justify-between border-t border-white/10 px-3 py-2">
              <span className="text-[11px] text-white/40">
                {activeFilterCount} فیلتر فعال
              </span>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="h-7 gap-1.5 px-2 text-[11px] text-white/50 hover:bg-white/5 hover:text-white"
              >
                <X className="size-3" />
                حذف همه
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

interface FilterFieldProps {
  filter: DataTableFilterConfig;

  value:
    | string
    | number
    | undefined;

  onChange: (
    value:
      | string
      | number
      | undefined,
  ) => void;

  onClear: () => void;
}

function FilterField({
  filter,
  value,
  onChange,
  onClear,
}: FilterFieldProps) {
  if (filter.type === "select") {
    return (
      <div className="space-y-3">
        <div>
          <Label className="text-xs font-semibold text-white">
            {filter.label}
          </Label>

          <p className="mt-1 text-[11px] text-white/40">
            مقدار موردنظر را انتخاب کنید
          </p>
        </div>

        <div className="space-y-1">
          {filter.options?.map(
            (option) => {
              const selected =
                String(value ?? "") ===
                option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    onChange(
                      selected
                        ? undefined
                        : option.value,
                    )
                  }
                  className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-right text-xs transition-colors ${
                    selected
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-white/5 bg-white/[0.02] text-white/70 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span>
                    {option.label}
                  </span>

                  {selected && (
                    <Check className="size-3.5" />
                  )}
                </button>
              );
            },
          )}
        </div>

        {value !== undefined && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="h-7 w-full text-xs text-white/50 hover:bg-white/5 hover:text-white"
          >
            حذف این فیلتر
          </Button>
        )}
      </div>
    );
  }

  if (filter.type === "number") {
    return (
      <div className="space-y-3">
        <div>
          <Label className="text-xs font-semibold text-white">
            {filter.label}
          </Label>
        </div>

        <Input
          type="number"
          value={value ?? ""}
          onChange={(event) => {
            const nextValue =
              event.target.value;

            onChange(
              nextValue === ""
                ? undefined
                : Number(nextValue),
            );
          }}
          placeholder={
            filter.placeholder
          }
          className="h-9 border-white/10 bg-white/5 text-xs text-white placeholder:text-white/30"
        />

        {value !== undefined && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="h-7 w-full text-xs text-white/50 hover:bg-white/5 hover:text-white"
          >
            حذف این فیلتر
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs font-semibold text-white">
          {filter.label}
        </Label>
      </div>

      <Input
        value={value ?? ""}
        onChange={(event) =>
          onChange(
            event.target.value ||
              undefined,
          )
        }
        placeholder={
          filter.placeholder
        }
        className="h-9 border-white/10 bg-white/5 text-xs text-white placeholder:text-white/30"
      />

      {value !== undefined && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="h-7 w-full text-xs text-white/50 hover:bg-white/5 hover:text-white"
        >
          حذف این فیلتر
        </Button>
      )}
    </div>
  );
}