import { NextResponse } from "next/server";
import frontMatter from "/public/frontMatter.json";
import directoryMetaData from "/public/directoryMetaData.json";

export const config = {
  matcher: [
    "/",
    "/((?!api|assets|_next|static|public|translationCounts.json|favicon.ico|frontMatter.json|directoryMetaData.json|searchIndex.json).*)",
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
      const response = NextResponse.rewrite(new URL("/index.pli", request.url));
      response.cookies.set("filePath", "/");
      return response;
    }
    if (locale === "en") {
      console.log("Rewriting root path to /index.en");
      const response = NextResponse.rewrite(new URL("/index.en", request.url));
      response.cookies.set("filePath", "/");
      return response;
    }
  }

  // Check if pathname corresponds to a file
  const fileId = pathname.split("/").pop();
  const fileIdWithLocale = `${pathname.split("/").pop()}.${locale}`;
  const isFile = frontMatter[fileIdWithLocale] !== undefined;

  console.log(`pathname: ${pathname}, fileId: ${fileId}, isFile: ${isFile}`);
  // Pass through if URL already ends with locale-specific suffix, but serve without showing the suffix
  if (isFile && fileId !== "index" && `/${fileId}` === pathname) {
    // get prefix path
    let filePath = frontMatter[fileIdWithLocale].fullPath
      ? frontMatter[fileIdWithLocale].fullPath
      : `${frontMatter[fileIdWithLocale].path}${fileIdWithLocale}`;
    console.log(
      `Rewriting to serve file simple URL: ${fileId}, filePath: ${filePath}, request.url: ${request.url}`
    );
    const response = NextResponse.rewrite(new URL(filePath, request.url));
    if (filePath.includes("#")) {
      const fragment = filePath.split("#")[1];
      response.headers.set("X-Redirect-Fragment", fragment);
    }
    response.cookies.set("filePath", filePath);
    return response;
  }

  // valid file id but not exact file path
  if (isFile && fileId !== "index") {
    let filePath = frontMatter[fileIdWithLocale].fullPath
      ? frontMatter[fileIdWithLocale].fullPath
      : `${frontMatter[fileIdWithLocale].path}${fileIdWithLocale}`;
    console.log(`Redirecting to expected file path: ${fileId}`);
    const response = NextResponse.redirect(new URL(`/${fileId}`, request.url));
    response.cookies.set("filePath", filePath);
    return response;
  } else if (!isFile) {
    // Check if pathname corresponds to a directory
    const directoryId = pathname.split("/")[1];
    const isDirectory = directoryMetaData[directoryId] !== undefined;
    if (isDirectory && directoryMetaData[directoryId].fullPath) {
      const directoryPath = directoryMetaData[directoryId].fullPath;
      console.log(`Redirecting to expected directory path: ${directoryPath}`);
      const response = NextResponse.redirect(new URL(directoryPath, request.url));
      response.cookies.set("filePath", directoryPath);
      return response;
    } else if (pathname.endsWith("/")) {
      const newUrl = new URL(`${pathname}index`, request.url);
      console.log(`Rewriting directory path to: ${newUrl}`);
      const reponse = NextResponse.rewrite(newUrl);
      response.cookies.set("filePath", `${pathname}`);
      return response;
    } else if (pathname.indexOf(".") !== -1) {
      const newUrl = new URL(`${pathname}.${locale}`, request.url);
      const response = NextResponse.rewrite(newUrl);
      response.cookies.set("filePath", `${pathname}`);
      return response;
    }
  }

  // Treat as folder by rewriting to the same pathname
  console.log(`Treating as folder, rewriting to same pathname: ${pathname}`);
  const response = NextResponse.rewrite(new URL(`${pathname}`, request.url));
  response.cookies.set("filePath", `${pathname}`);
  return response;
}
