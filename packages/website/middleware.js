import { NextResponse } from "next/server";
import frontMatter from "/public/frontMatter.json";

export const config = {
  matcher: [
    "/",
    "/((?!api|_next|static|public|translationCounts.json|favicon.ico|frontMatter.json|searchIndex.json).*)",
  ],
};

export function middleware(request) {
  const { pathname, searchParams } = request.nextUrl;
  const cookies = request.cookies;
  let locale = cookies.get("NEXT_LOCALE")?.value;

  // Determine locale from cookies or 'accept-language' header
  if (!locale) {
    const acceptLanguageHeader = request.headers.get("accept-language") || "en";
    locale = acceptLanguageHeader.split(",")[0].split("-")[0];
    console.log(
      `Locale not found in cookies. Setting locale from 'accept-language' header: ${locale}`
    );
    const response = NextResponse.next();
    response.cookies.set("NEXT_LOCALE", locale, { path: "/" });
  }

  // Ensure lowercase URLs
  const lowercasePathname = pathname.toLowerCase();
  if (pathname !== lowercasePathname) {
    console.log(`Redirecting to lowercase pathname: ${lowercasePathname}`);
    const response = NextResponse.redirect(
      new URL(lowercasePathname + searchParams.toString(), request.url)
    );
    response.headers.set("x-internal-redirect", "true");
    return response;
  }

  // Handle root path based on locale
  if (pathname === "/") {
    if (locale === "pli") {
      console.log("Rewriting root path to /index.pli");
      const response = NextResponse.rewrite(new URL("/index.pli", request.url));
      response.headers.set("x-internal-redirect", "true");
      return response;
    }
    if (locale === "en") {
      console.log("Rewriting root path to /index.en");
      const response = NextResponse.rewrite(new URL("/index.en", request.url));
      response.headers.set("x-internal-redirect", "true");
      return response;
    }
  }

  // Pass through if URL already ends with locale-specific suffix, but serve without showing the suffix
  if (pathname.endsWith(`.${locale}`)) {
    const isInternalRedirect = request.headers.get("x-internal-redirect");
    if (!isInternalRedirect) {
      const cleanPath = pathname.replace(`.${locale}`, "");
      console.log(
        `Rewriting to serve file without locale suffix: ${cleanPath}`
      );
      const response = NextResponse.redirect(new URL(cleanPath, request.url));
      response.headers.set("x-internal-redirect", "true");
      return response;
    } else {
      console.log(
        "Pathname already ends with locale-specific suffix and is internally redirected, serving without showing locale suffix in the URL."
      );
      return NextResponse.next();
    }
  }

  // Check if pathname corresponds to a file
  const fileId = pathname.split("/").pop();
  const isFile = frontMatter[`${fileId}.${locale}`] !== undefined;

  if (isFile && fileId !== "index") {
    let prefixPath = frontMatter[`${fileId}.${locale}`].path;
    let expectedPath = `${prefixPath}${fileId}`;
    if (pathname !== expectedPath) {
      console.log(`Redirecting to expected file path: ${expectedPath}`);
      const response = NextResponse.redirect(
        new URL(expectedPath, request.url)
      );
      response.headers.set("x-internal-redirect", "true");
      return response;
    } else {
      const newUrl = new URL(`${pathname}.${locale}`, request.url);
      console.log(`Rewriting to serve file: ${newUrl}`);
      const response = NextResponse.rewrite(newUrl);
      response.headers.set("x-internal-redirect", "true");
      return response;
    }
  } else if (!isFile) {
    // Check if pathname corresponds to a directory
    if (pathname.endsWith("/")) {
      const newUrl = new URL(`${pathname}index`, request.url);
      console.log(`Rewriting directory path to: ${newUrl}`);
      const response = NextResponse.rewrite(newUrl);
      response.headers.set("x-internal-redirect", "true");
      return response;
    } else if (pathname.indexOf(".") !== -1) {
      const newUrl = new URL(`${pathname}.${locale}`, request.url);
      const response = NextResponse.rewrite(newUrl);
      response.headers.set("x-internal-redirect", "true");
      return response;
    }
  }

  // Treat as folder by rewriting to the same pathname
  console.log(`Treating as folder, rewriting to same pathname: ${pathname}`);
  const response = NextResponse.rewrite(new URL(`${pathname}`, request.url));
  response.headers.set("x-internal-redirect", "true");
  return response;
}
