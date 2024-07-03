import { withLocales } from 'nextra/locales';
import { NextResponse } from 'next/server';

export const config = {
  matcher: '/((?!_next|static|favicon.ico|frontMatter.json).*)',
};

export const middleware = withLocales((request) => {
  const { pathname, searchParams } = request.nextUrl;
  const cookies = request.cookies;
  let locale = request.nextUrl.locale || 'en';

  request.nextUrl.locale = locale;

  // Normalize the pathname to lowercase
  const lowercasePathname = pathname.toLowerCase();
  if (pathname !== lowercasePathname) {
    return NextResponse.redirect(new URL(lowercasePathname + searchParams.toString(), request.url));
  }

  // Skip redirection if the pathname already has the locale suffix
  if (pathname.endsWith('.en') || pathname.endsWith('.pli')) {
    return NextResponse.next();
  }

  // Handle locale-based file serving
  let newUrl;
  if (locale === 'pli') {
    newUrl = new URL(`${pathname}.pli`, request.url);
  } else {
    newUrl = new URL(`${pathname}.en`, request.url);
  }

  return NextResponse.rewrite(newUrl);
});
