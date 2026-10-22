"use client";

import {useSyncExternalStore} from "react";
import {ArrowLeft} from "lucide-react";
import {Button} from "@/components/ui/button";

function subscribe(notify: () => void) {
  window.addEventListener("popstate", notify);
  window.addEventListener("pageshow", notify);
  return () => {
    window.removeEventListener("popstate", notify);
    window.removeEventListener("pageshow", notify);
  };
}

export function GoBackButton({label}: {label: string}) {
  const available = useSyncExternalStore(subscribe, () => window.history.length > 1, () => false);
  return available ? <Button variant="outline" onClick={() => window.history.back()}>
    <ArrowLeft aria-hidden="true" className="rtl:rotate-180" />{label}
  </Button> : null;
}
