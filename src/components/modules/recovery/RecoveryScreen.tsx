import type {ReactNode} from "react";
import {StateIllustration} from "@/components/illustrations/StateIllustration";

export type RecoveryCopy = {eyebrow: string; title: string; description: string; documentTitle: string};

export function RecoveryScreen({status, copy, actions}: {status: "404" | "500"; copy: RecoveryCopy; actions: ReactNode}) {
  return <main aria-labelledby="recovery-title" className="mx-auto grid min-h-[65vh] w-full max-w-6xl items-center gap-6 px-6 py-10 sm:px-8 sm:py-16 lg:grid-cols-2 lg:gap-12 lg:py-20">
    <title>{copy.documentTitle}</title>
    <meta name="robots" content="noindex" />
    <div className="order-2 min-w-0 text-center lg:order-1 lg:text-start">
      <p className="mb-4 inline-flex items-center gap-2 text-xs font-semibold text-primary sm:text-sm">
        <span aria-hidden="true" className="h-px w-6 bg-primary/60" />{copy.eyebrow}
      </p>
      <p aria-hidden="true" className="mb-3 font-mono text-6xl font-light leading-none tracking-tight text-primary sm:text-7xl">{status}</p>
      <h1 id="recovery-title" className="text-2xl font-bold leading-tight text-foreground sm:text-4xl">{copy.title}</h1>
      <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-text-secondary sm:text-base lg:mx-0">{copy.description}</p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-3 lg:justify-start">{actions}</div>
    </div>
    <div className="order-1 mx-auto w-full max-w-[19rem] sm:max-w-[25rem] lg:order-2 lg:max-w-none">
      <StateIllustration kind={status === "404" ? "not-found" : "disconnected"} />
    </div>
  </main>;
}
