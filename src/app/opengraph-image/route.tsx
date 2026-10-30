import {ImageResponse} from 'next/og';

// Explicitly referenced by public-page metadata; do not inherit it on private/404 pages.
export const dynamic = 'force-static';

export function GET() {
  return new ImageResponse(
    <div style={{display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', background: '#0b1220', color: '#ecf2f7', borderBottom: '20px solid #47d5e2'}}>
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24}}>
        <div style={{fontSize: 100, fontWeight: 700, letterSpacing: -4}}>DreamService</div>
        <div style={{fontSize: 32, color: '#47d5e2'}}>dreamservice.net</div>
      </div>
    </div>,
    {width: 1200, height: 630}
  );
}
