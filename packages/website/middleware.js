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
    return response;
  }

  // Handle root path based on locale
  if (pathname === "/") {
    if (locale === "pli") {
      console.log("Rewriting root path to /index.pli");
      return NextResponse.rewrite(new URL("/index.pli", request.url));
    }
    if (locale === "en") {
      console.log("Rewriting root path to /index.en");
      return NextResponse.rewrite(new URL("/index.en", request.url));
    }
  }

  // Check if pathname corresponds to a file
  const fileId = pathname.split("/").pop();
  const isFile = frontMatter[`${fileId}.${locale}`] !== undefined;

  console.log(`pathname: ${pathname}, fileId: ${fileId}, isFile: ${isFile}`);
  // Pass through if URL already ends with locale-specific suffix, but serve without showing the suffix
  if (isFile && fileId !== "index" && `/${fileId}` === pathname) {
    // get prefix path
    let prefixPath = frontMatter[`${fileId}.${locale}`].path;
    console.log(`Rewriting to serve file simple URL: ${fileId}`);
    return NextResponse.rewrite(
      new URL(`${prefixPath}${fileId}.${locale}`, request.url)
    );
  }

  // valid file id but not exact file path
  if (isFile && fileId !== "index") {
    let prefixPath = frontMatter[`${fileId}.${locale}`].path;
    console.log(`Redirecting to expected file path: ${fileId}`);
    const response = NextResponse.redirect(new URL(`/${fileId}`, request.url));
    response.cookies.set("filePath", `${prefixPath}${fileId}`);
    return response;
  } else if (!isFile) {
    // Check if pathname corresponds to a directory
    if (pathname.endsWith("/")) {
      const newUrl = new URL(`${pathname}index`, request.url);
      console.log(`Rewriting directory path to: ${newUrl}`);
      return NextResponse.rewrite(newUrl);
    } else if (pathname.indexOf(".") !== -1) {
      const newUrl = new URL(`${pathname}.${locale}`, request.url);
      return NextResponse.rewrite(newUrl);
    }
  }

  // Treat as folder by rewriting to the same pathname
  console.log(`Treating as folder, rewriting to same pathname: ${pathname}`);
  const response = NextResponse.rewrite(new URL(`${pathname}`, request.url));
  return response;
}
