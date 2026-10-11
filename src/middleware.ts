import middleware from '../middleware';

// Next discovers middleware alongside src/app. Keep the root implementation shared.
export default middleware;
export const config = {
  matcher: ['/((?!api(?:/|$)|_next|_vercel|.*\\..*).*)']
};
