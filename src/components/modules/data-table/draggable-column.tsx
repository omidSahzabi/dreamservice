"use client";

import * as React from "react";

import {
  type Header,
  flexRender,
} from "@tanstack/react-table";

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
  TableHead,
} from "@/components/ui/table";

interface DraggableColumnProps<TData> {
  header: Header<TData, unknown>;
  draggable?: boolean;
}

export function DraggableColumn<TData>({
  header,
  draggable = true,
}: DraggableColumnProps<TData>) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: header.column.id,
    disabled: !draggable,
  });

  const style: React.CSSProperties = {
    width: header.getSize(),
    minWidth: header.getSize(),
    position: "relative",
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 20 : 1,
    opacity: isDragging ? 0.7 : 1,
  };

  return (
    <TableHead
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="group relative"
    >
      <div className="flex min-w-0 items-center">
        {draggable && (
          <button
            type="button"
            {...listeners}
            className="mr-1 cursor-grab rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100 active:cursor-grabbing"
            aria-label={`Move ${header.column.id}`}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        )}

        <div className="min-w-0 flex-1 truncate">
          {flexRender(
            header.column.columnDef.header,
            header.getContext(),
          )}
        </div>
      </div>

      {header.column.getCanResize() && (
        <div
          onMouseDown={header.getResizeHandler()}
          onTouchStart={header.getResizeHandler()}
          className={`absolute right-0 top-0 h-full w-1 cursor-col-resize touch-none select-none ${
            header.column.getIsResizing()
              ? "bg-primary"
              : "hover:bg-muted-foreground/30"
          }`}
        />
      )}
    </TableHead>
  );
}