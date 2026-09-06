"use client";

import {
  Check,
  Rows3,
} from "lucide-react";

import {
  Button,
} from "@/components/ui/button";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import type {
  DataTableDensity,
} from "./data-table-types";

interface Props {
  density: DataTableDensity;
  onChange: (
    density: DataTableDensity,
  ) => void;
}

const options: {
  value: DataTableDensity;
  label: string;
}[] = [
  {
    value: "compact",
    label: "Compact",
  },
  {
    value: "default",
    label: "Default",
  },
  {
    value: "comfortable",
    label: "Comfortable",
  },
];

export function DataTableDensity({
  density,
  onChange,
}: Props) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8"
        >
          <Rows3 className="mr-2 h-4 w-4" />
          Density
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-[180px]"
      >
        <div className="space-y-1">
          {options.map((option) => (
            <Button
              key={option.value}
              variant="ghost"
              className="w-full justify-between"
              onClick={() =>
                onChange(option.value)
              }
            >
              {option.label}

              {density === option.value && (
                <Check className="h-4 w-4" />
              )}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}