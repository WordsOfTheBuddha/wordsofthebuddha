import { NextResponse } from "next/server";
import frontMatter from "/public/frontMatter.json";

export const config = {
  matcher: ["/", "/((?!api|_next|static|public|translationCounts.json).*)"],
};

export function middleware(request) {
  const { pathname, searchParams } = request.nextUrl;
  const cookies = request.cookies;
  let locale = cookies.get("NEXT_LOCALE")?.value;

  // Determine locale from cookies or 'accept-language' header
  if (!locale) {
    const acceptLanguageHeader = request.headers.get("accept-language") || "en";
    locale = acceptLanguageHeader.split(",")[0].split("-")[0];
    const response = NextResponse.next();
    response.cookies.set("NEXT_LOCALE", locale, { path: "/" });
    return response;
  }

  // Ensure lowercase URLs
  const lowercasePathname = pathname.toLowerCase();
  if (pathname !== lowercasePathname) {
    return NextResponse.redirect(
      new URL(lowercasePathname + searchParams.toString(), request.url)
    );
  }

  // Handle root path based on locale
  if (pathname === "/" && locale === "pli") {
    return NextResponse.rewrite(new URL("/index.pli", request.url));
  }

  if (pathname === "/" && locale === "en") {
    return NextResponse.rewrite(new URL("/index.en", request.url));
  }

  // Pass through if URL already ends with locale-specific suffix
  if (pathname.endsWith(".en") || pathname.endsWith(".pli")) {
    return NextResponse.next();
  }

  // Check if pathname corresponds to a file
  const fileId = pathname.split("/").pop();
  const isFile = frontMatter[`${fileId}.${locale}`] !== undefined;

  if (isFile && fileId !== "index") {
    let prefixPath = frontMatter[`${fileId}.${locale}`].path;
    let expectedPath = `${prefixPath}${fileId}`;
    // Check if the current pathname matches the expected path
    if (pathname !== expectedPath) {
      console.log("redirecting to: ", expectedPath);
      return NextResponse.redirect(new URL(expectedPath, request.url));
    } else {
      console.log("path matches, rewriting to serve file: ", expectedPath);
      const newUrl = new URL(`${pathname}.en`, request.url);
      return NextResponse.rewrite(newUrl);
    }
  } else if (!isFile) {
    // Check if pathname corresponds to a directory
    // check if pathname ends in /
    if (pathname.endsWith("/")) {
      const newUrl = new URL(`${pathname}index`, request.url);
      return NextResponse.rewrite(newUrl);
    } else if (pathname.indexOf(".") !== -1) {
      const newUrl = new URL(`${pathname}.en`, request.url);
      return NextResponse.rewrite(newUrl);
    }
  }

  // Treat as folder by rewriting to the same pathname
  return NextResponse.rewrite(new URL(`${pathname}`, request.url));
}
