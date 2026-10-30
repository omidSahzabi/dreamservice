import middleware from '../middleware';

// Next discovers middleware alongside src/app. Keep the root implementation shared.
export default middleware;
export const config = {
  matcher: ['/((?!api(?:/|$)|opengraph-image(?:/|$)|_next|_vercel|.*\\..*).*)']
};
