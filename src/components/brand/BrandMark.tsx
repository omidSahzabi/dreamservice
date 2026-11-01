import type {SVGProps} from "react";
import {useId} from "react";
import geometry from "./geometry.json";

/** Shared bow-D geometry. The arrow always points right, including in RTL. */
export function BrandMark(props: SVGProps<SVGSVGElement>) {
  const maskId = useId();
  return (
    <svg viewBox={geometry.viewBox} fill="currentColor" aria-hidden="true" focusable="false" {...props}>
      <defs>
        <mask id={maskId}>
          <rect width="32" height="32" fill="white" />
          <path d={geometry.clearance} fill="black" />
        </mask>
      </defs>
      <path d={geometry.arch} fillRule="evenodd" mask={`url(#${maskId})`} />
      <g className="ds-brand-accent">
        <path d={geometry.string} fill="none" stroke="currentColor" strokeWidth=".8" />
        <path d={geometry.needle} />
        <path d={geometry.star} fill="none" stroke="currentColor" strokeWidth=".65" />
      </g>
    </svg>
  );
}
