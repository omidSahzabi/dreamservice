import type { ReactNode } from "react";

// The locale layout supplies the document's html/body, language and direction.
// The root redirect also needs a layout entry point during production builds.
export default function AppLayout({ children }: { children: ReactNode }) {
  return children;
}
