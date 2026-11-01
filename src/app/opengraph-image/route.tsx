import {ImageResponse} from 'next/og';
import geometry from '@/components/brand/geometry.json';

// Explicitly referenced by public-page metadata; do not inherit it on private/404 pages.
export const dynamic = 'force-static';

export function GET() {
  return new ImageResponse(
    <div style={{display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', background: '#06111E', color: '#F8FAFC', borderBottom: '8px solid #06B6D4'}}>
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24}}>
        <svg width="920" height="132" viewBox={geometry.wordmark.viewBox} fill="none">
          <g transform={geometry.wordmark.markTransform}>
            <path d={geometry.arch} fill="#F8FAFC" fillRule="evenodd" />
            <path d={geometry.string} stroke="#22D3EE" strokeWidth=".8" />
            <path d={geometry.needle} fill="#22D3EE" stroke="#06111E" strokeWidth="1.2" />
            <path d={geometry.star} stroke="#22D3EE" strokeWidth=".65" />
          </g>
          <g strokeWidth="5.2" strokeLinecap="round" strokeLinejoin="round">
            {geometry.wordmark.dream.map(d => <path key={d} d={d} stroke="#F8FAFC" />)}
            {geometry.wordmark.service.map(d => <path key={d} d={d} stroke="#22D3EE" />)}
            <path d={geometry.wordmark.dot} fill="#22D3EE" />
          </g>
        </svg>
        <div style={{fontSize: 32, color: '#22D3EE'}}>dreamservice.net</div>
      </div>
    </div>,
    {width: 1200, height: 630}
  );
}
