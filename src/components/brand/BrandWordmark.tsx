import type {SVGProps} from "react";
import {BrandMark} from "./BrandMark";
import geometry from "./geometry.json";

/** Custom path lettering; the bow is the first letter, never a separate icon. */
export function BrandWordmark({compact = false, ...props}: SVGProps<SVGSVGElement> & {compact?: boolean}) {
  const wordmark = geometry.wordmark;
  return <svg viewBox={compact ? wordmark.compactViewBox : wordmark.viewBox} fill="none" aria-hidden="true" focusable="false" {...props}>
    <g transform={wordmark.markTransform}><BrandMark width="32" height="32" /></g>
    <g stroke="currentColor" strokeWidth="5.2" strokeLinecap="round" strokeLinejoin="round">
      {wordmark.dream.map(d => <path key={d} d={d} />)}
      <g className="ds-brand-accent">
        {wordmark.service.map(d => <path key={d} d={d} />)}
        <path d={wordmark.dot} fill="currentColor" stroke="none" />
      </g>
    </g>
  </svg>;
}
