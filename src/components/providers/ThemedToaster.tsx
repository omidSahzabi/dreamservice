"use client";

import type {ComponentProps} from "react";
import {useTheme} from "next-themes";
import {Toaster} from "sonner";

export function ThemedToaster(props: ComponentProps<typeof Toaster>) {
  const {resolvedTheme} = useTheme();
  const themeStyle = {
    fontFamily: "inherit",
    "--normal-bg": "var(--popover)",
    "--normal-text": "var(--foreground)",
    "--normal-border": "var(--border)",
    "--success-text": "var(--success)",
    "--error-text": "var(--destructive)",
    "--warning-text": "var(--warning)",
    "--info-text": "var(--primary)",
  };
  return <Toaster {...props} theme={resolvedTheme === "dark" ? "dark" : resolvedTheme === "light" ? "light" : "system"} style={{...themeStyle, ...props.style}} />;
}
