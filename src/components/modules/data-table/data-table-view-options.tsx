"use client";

import * as React from "react";

import type {
  Table,
} from "@tanstack/react-table";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";

import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import {
  arrayMove,
} from "@dnd-kit/sortable";

import {
  Settings2,
} from "lucide-react";

import {
  Button,
} from "@/components/ui/button";

import {
  Separator,
} from "@/components/ui/separator";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import {
  SortableColumnItem,
} from "./sortable-column-item";

import {
  getColumnLabel,
} from "./data-table-utils";

interface Props<TData> {
  table: Table<TData>;
  onColumnOrderChange: (
    order: string[],
  ) => void;
}

export function DataTableViewOptions<TData>({
  table,
  onColumnOrderChange,
}: Props<TData>) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
  );

  const columns =
    table.getAllLeafColumns();

  const order =
    table.getState().columnOrder.length
      ? table.getState().columnOrder
      : columns.map(
          (column) => column.id,
        );

  function handleDragEnd(
    event: DragEndEvent,
  ) {
    const {
      active,
      over,
    } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex =
      order.indexOf(String(active.id));

    const newIndex =
      order.indexOf(String(over.id));

    if (
      oldIndex === -1 ||
      newIndex === -1
    ) {
      return;
    }

    onColumnOrderChange(
      arrayMove(
        order,
        oldIndex,
        newIndex,
      ),
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8"
        >
          <Settings2 className="mr-2 h-4 w-4" />
          Columns
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-[280px]"
      >
        <div className="space-y-3">
          <div>
            <h4 className="font-medium">
              Columns
            </h4>

            <p className="text-xs text-muted-foreground">
              Show, hide or reorder columns.
            </p>
          </div>

          <Separator />

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={order}
              strategy={
                verticalListSortingStrategy
              }
            >
              <div className="max-h-[350px] space-y-1 overflow-y-auto">
                {order.map((id) => {
                  const column =
                    table.getColumn(id);

                  if (!column) {
                    return null;
                  }

                  const hideable =
                    column.getCanHide();

                  return (
                    <SortableColumnItem
                      key={id}
                      id={id}
                      label={getColumnLabel(
                        column,
                      )}
                      visible={
                        column.getIsVisible()
                      }
                      onVisibilityChange={(
                        value,
                      ) => {
                        if (!hideable) {
                          return;
                        }

                        column.toggleVisibility(
                          value,
                        );
                      }}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>

          <Separator />

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="flex-1"
              onClick={() => {
                columns.forEach(
                  (column) => {
                    if (
                      column.getCanHide()
                    ) {
                      column.toggleVisibility(
                        true,
                      );
                    }
                  },
                );
              }}
            >
              Show all
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="flex-1"
              onClick={() => {
                columns.forEach(
                  (column) => {
                    if (
                      column.getCanHide()
                    ) {
                      column.toggleVisibility(
                        false,
                      );
                    }
                  },
                );
              }}
            >
              Hide all
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}