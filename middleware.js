import { NextResponse } from "next/server";

export const config = {
    matcher: [
      "/",
      "/((?!api|_next|static|public|translationCounts.json).*)"
    ]
  };

export function middleware(request) {
  const { pathname, searchParams } = request.nextUrl;
  const cookies = request.cookies;
  let locale = cookies.get("NEXT_LOCALE")?.value;

  // If the locale is not set in the cookies, use the Accept-Language header and set the cookie
  if (!locale) {
    const acceptLanguageHeader = request.headers.get("accept-language") || "en";
    locale = acceptLanguageHeader.split(",")[0].split("-")[0];
    const response = NextResponse.next();
    response.cookies.set("NEXT_LOCALE", locale, { path: "/" });
    console.log(`Set locale from Accept-Language header: ${locale}`);
    return response;
  }

  console.log(`Middleware triggered for pathname: ${pathname}`);
  console.log(`Detected Locale from Cookie: ${locale}`);

  // Set the locale in nextUrl
  request.nextUrl.locale = locale;

  // Normalize the pathname to lowercase
  const lowercasePathname = pathname.toLowerCase();
  if (pathname !== lowercasePathname) {
    console.log(`Redirecting to lowercase pathname: ${lowercasePathname}`);
    return NextResponse.redirect(
      new URL(lowercasePathname + searchParams.toString(), request.url)
    );
  }

  // Handle root-level locale files
  if (pathname === "/" && locale === "pli") {
    console.log(`Rewriting root to /index.pli`);
    return NextResponse.rewrite(new URL("/index.pli", request.url));
  }

  if (pathname === "/" && locale === "en") {
    console.log(`Rewriting root to /index.en`);
    return NextResponse.rewrite(new URL("/index.en", request.url));
  }

  // Skip redirection if the pathname already has the locale suffix
  if (pathname.endsWith(".en") || pathname.endsWith(".pli")) {
    console.log(`Pathname already ends with locale suffix: ${pathname}`);
    return NextResponse.next();
  }

  // Handle locale-based file serving
  let newUrl;
  if (locale === "pli") {
    newUrl = new URL(`${pathname}.pli`, request.url);
    console.log(`Rewriting to PLI file: ${newUrl}`);
  } else {
    newUrl = new URL(`${pathname}.en`, request.url);
    console.log(`Rewriting to EN file: ${newUrl}`);
  }

  return NextResponse.rewrite(newUrl);
}
