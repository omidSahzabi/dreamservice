"use client";

import {useEffect} from "react";

export function useErrorReport(error: unknown, boundary: "locale" | "global") {
  useEffect(() => {
    // Never include the exception, its message/digest/stack, URL or user data.
    console.error(JSON.stringify({event: "render_failed", category: "application_error", boundary}));
  }, [error, boundary]);
}

export type ErrorBoundaryProps = {
  error: unknown;
  reset: () => void;
  // Next.js 16.2 supplies a retry that refreshes server content before resetting.
  unstable_retry?: () => void;
};
