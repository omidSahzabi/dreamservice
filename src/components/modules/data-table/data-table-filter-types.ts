export type DataTableFilterOption = {
  value: string
  label: string
}

export type DataTableFilterField =
  | {
      id: string
      label: string
      type: "text"
      placeholder?: string
    }
  | {
      id: string
      label: string
      type: "select"
      placeholder?: string
      options: DataTableFilterOption[]
    }

export type DataTableFilterValues = Record<string, string>
