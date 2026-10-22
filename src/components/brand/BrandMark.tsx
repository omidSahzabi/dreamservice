import type {SVGProps} from "react";
import {useId} from "react";
import geometry from "./geometry.json";

/** A D-shaped arch with a right-pointing compass needle. Never mirror in RTL. */
export function BrandMark(props: SVGProps<SVGSVGElement>) {
  const maskId = useId();
  return (
    <svg viewBox={geometry.viewBox} fill="currentColor" aria-hidden="true" {...props}>
      <defs>
        <mask id={maskId}>
          <rect width="32" height="32" fill="white" />
          <path d={geometry.clearance} fill="black" />
        </mask>
      </defs>
      <path d={geometry.arch} fillRule="evenodd" mask={`url(#${maskId})`} />
      <path d={geometry.needle} />
    </svg>
  );
}
