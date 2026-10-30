import {cn} from "@/lib/utils";

export type IllustrationKind = "not-found" | "disconnected" | "empty-orders";

/** Original, shared isometric artwork. Meaning is supplied by the adjacent text. */
export function StateIllustration({kind, className}: {kind: IllustrationKind; className?: string}) {
  return <svg
    aria-hidden="true" focusable="false" viewBox="0 0 440 320" fill="none"
    stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round"
    data-state-illustration={kind}
    className={cn("pointer-events-none h-auto w-full select-none text-primary", className)}
  >
    <path d="m220 191 128 64-128 64-128-64Z" className="stroke-border" />
    <path d="M92 255h-23m302 0h-23M220 319v-13" className="stroke-border" />
    <g strokeOpacity=".35">
      <path d="M112 187v12l108 54 108-54v-12" className="fill-secondary" />
      <path d="m220 133 108 54-108 54-108-54Z" className="fill-card" />
    </g>

    {kind === "not-found" ? <>
      <path d="m274 160 54 27-54 27-54-27Z" className="fill-background stroke-primary/40" strokeDasharray="4 6" />
      <path d="m220 148 78 39-78 39-78-39Z" strokeOpacity=".2" />
      <path d="m220 133-54 81m-54-27 108 54" strokeOpacity=".18" />
      <path d="m337 82 54 27-54 27-54-27Z" className="fill-accent" />
      <path d="M283 109v7l54 27 54-27v-7m-54 27v7" strokeOpacity=".6" />
      <path d="m337 95 28 14-28 14-28-14Z" strokeOpacity=".4" />
      <path d="m310 150-22 23m-8 8-6 6" strokeDasharray="2 6" strokeOpacity=".55" />
      <circle cx="103" cy="102" r="33" strokeOpacity=".3" />
      <path d="M103 61v9m0 64v9m-41-41h9m64 0h9m-59 0 37-12-12 12 12 12Z" strokeOpacity=".7" />
      <path d="m78 207 8 4-8 4-8-4Zm274-15 6 3-6 3-6-3Z" className="fill-primary/10" strokeOpacity=".6" />
    </> : kind === "disconnected" ? <>
      <path d="m220 149 76 38-76 38-76-38Z" strokeOpacity=".25" />
      <path d="M154 131v39l31 16m100-75v50l-29 15" strokeDasharray="3 6" strokeOpacity=".6" />
      <path d="m154 83 55 27-55 28-55-28Zm131-30 55 27-55 28-55-28Z" className="fill-card" />
      <path d="M99 110v7l55 28 55-28v-7m21-30v7l55 28 55-28v-7" strokeOpacity=".4" />
      <path d="m154 96 28 14-28 14-28-14Zm131-30 28 14-28 14-28-14Z" className="fill-accent" strokeOpacity=".6" />
      <circle cx="220" cy="133" r="24" className="fill-background stroke-border" />
      <path d="m204 133 8-4 8 4-8 4Zm24 0 8-4 8 4-8 4Z" strokeOpacity=".7" />
      <path d="m216 119 8-5m-8 38 8-5" className="stroke-destructive" />
      <circle cx="220" cy="187" r="5" className="fill-primary/20" />
      <path d="M154 201v44m131-45v28" strokeOpacity=".25" />
      <circle cx="90" cy="162" r="2" className="fill-primary" stroke="none" />
      <circle cx="354" cy="143" r="2" className="fill-primary" stroke="none" />
    </> : <>
      <path d="m220 151 72 36-72 36-72-36Z" strokeOpacity=".25" />
      <path d="M183 67v112l69 40V107l-23-14Z" className="fill-card" />
      <path d="m183 67 46 26v27l23-13m-23 13 23-13" className="fill-accent" />
      <path d="m197 108 18 10m-18 8 40 23m-40-5 40 23m-40-5 27 15" strokeOpacity=".55" />
      <path d="M220 220v35" strokeDasharray="3 5" strokeOpacity=".4" />
      <path d="m128 127 8 4-8 4-8-4Zm182 20 7 4-7 4-7-4Z" className="fill-primary/10" />
      <path d="M131 163v12m173 16v13m-28-108v8" strokeOpacity=".45" />
      <circle cx="156" cy="94" r="2" className="fill-primary" stroke="none" />
      <circle cx="293" cy="118" r="2" className="fill-primary" stroke="none" />
    </>}
  </svg>;
}
