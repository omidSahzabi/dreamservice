"use client";

import {
  useSortable,
} from "@dnd-kit/sortable";

import {
  CSS,
} from "@dnd-kit/utilities";

import {
  GripVertical,
} from "lucide-react";

import {
  Checkbox,
} from "@/components/ui/checkbox";

interface Props {
  id: string;
  label: string;
  visible: boolean;
  onVisibilityChange: (
    value: boolean,
  ) => void;
}

export function SortableColumnItem({
  id,
  label,
  visible,
  onVisibilityChange,
}: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(
          transform,
        ),
        transition,
      }}
      className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
      {...attributes}
    >
      <button
        type="button"
        {...listeners}
        className="cursor-grab text-muted-foreground active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <Checkbox
        checked={visible}
        onCheckedChange={(value) =>
          onVisibilityChange(Boolean(value))
        }
      />

      <span className="flex-1 truncate text-sm">
        {label}
      </span>
    </div>
  );
}