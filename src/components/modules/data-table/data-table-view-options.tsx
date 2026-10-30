"use client";

import {useTranslations} from "next-intl";

import type {
  Table,
} from "@tanstack/react-table";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";

import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
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
  onColumnOrderChange?: (
    order: string[],
  ) => void;
}

export function DataTableViewOptions<TData>({
  table,
  onColumnOrderChange,
}: Props<TData>) {
  const t = useTranslations("DataTable");
  const labelFor = (id: string | number) => {const column = table.getColumn(String(id)); return column ? getColumnLabel(column) : t("columns");};
  const sensors = useSensors(
    useSensor(KeyboardSensor, {coordinateGetter: sortableKeyboardCoordinates}),
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

    (onColumnOrderChange ?? table.setColumnOrder)(
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
          <Settings2 className="me-2 h-4 w-4" />
          {t("columns")}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-[280px]"
      >
        <div className="space-y-3">
          <div>
            <h4 className="font-medium">
              {t("columns")}
            </h4>

            <p className="text-xs text-muted-foreground">
              {t("columnsDescription")}
            </p>
          </div>

          <Separator />

          <DndContext
            accessibility={{
              screenReaderInstructions: {draggable: t("dragInstructions")},
              announcements: {
                onDragStart: ({active}) => t("dragStart", {label: labelFor(active.id)}),
                onDragOver: ({active, over}) => over ? t("dragOver", {label: labelFor(active.id), target: labelFor(over.id)}) : undefined,
                onDragEnd: ({active}) => t("dragEnd", {label: labelFor(active.id)}),
                onDragCancel: ({active}) => t("dragCancel", {label: labelFor(active.id)})
              }
            }}
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
              {t("showAll")}
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
              {t("hideAll")}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}