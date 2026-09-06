"use client";

import {
  MoreHorizontal,
  Pin,
  PinOff,
  EyeOff,
} from "lucide-react";

import type {
  Column,
} from "@tanstack/react-table";

import {
  Button,
} from "@/components/ui/button";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props<TData, TValue> {
  column: Column<TData, TValue>;
}

export function DataTableColumnMenu<
  TData,
  TValue,
>({
  column,
}: Props<TData, TValue>) {
  const pinned =
    column.getIsPinned();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        {column.getCanPin() && (
          <>
            {!pinned && (
              <>
                <DropdownMenuItem
                  onClick={() =>
                    column.pin("left")
                  }
                >
                  <Pin className="mr-2 h-4 w-4" />
                  Pin left
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() =>
                    column.pin("right")
                  }
                >
                  <Pin className="mr-2 h-4 w-4" />
                  Pin right
                </DropdownMenuItem>
              </>
            )}

            {pinned && (
              <DropdownMenuItem
                onClick={() =>
                  column.pin(false)
                }
              >
                <PinOff className="mr-2 h-4 w-4" />
                Unpin
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />
          </>
        )}

        {column.getCanHide() && (
          <DropdownMenuItem
            onClick={() =>
              column.toggleVisibility(
                false,
              )
            }
          >
            <EyeOff className="mr-2 h-4 w-4" />
            Hide column
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}