import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { SECURITY_HEADERS, getCSPHeader } from "@/lib/security";
import { generateRequestId, trace } from "@/lib/trace";

const adminRoutes = ["/admin", "/api/admin"];
const authRoutes = ["/login", "/signup"];
const publicRoutes = ["/", "/pricing", "/terms", "/privacy", "/transparency"];

export default withAuth(
  function middleware(req) {
    const requestId = generateRequestId();
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;
    const url = req.nextUrl.clone();

    if (!token) {
      if (
        pathname === "/" ||
        publicRoutes.some((r) => pathname.startsWith(r)) ||
        authRoutes.some((r) => pathname.startsWith(r)) ||
        pathname.startsWith("/api/health") ||
        pathname.startsWith("/api/chat") ||
        pathname.startsWith("/reset-password")
      ) {
        return addSecurityHeaders(NextResponse.next(), requestId);
      }
      url.pathname = "/login";
      url.searchParams.set("callbackUrl", pathname);
      return addSecurityHeaders(NextResponse.redirect(url), requestId);
    }

    const role = (token as any).role ?? "user";

    if (adminRoutes.some((r) => pathname.startsWith(r))) {
      if (role !== "admin" && role !== "founder") {
        return addSecurityHeaders(NextResponse.redirect(new URL("/dashboard", req.url)), requestId);
      }
    }

    if (authRoutes.some((r) => pathname.startsWith(r)) || pathname.startsWith("/reset-password")) {
      return addSecurityHeaders(NextResponse.redirect(new URL("/dashboard", req.url)), requestId);
    }

    return addSecurityHeaders(NextResponse.next(), requestId);
  },
  {
    callbacks: {
      authorized({ req, token }) {
        const pathname = req.nextUrl.pathname;

        if (
pathname.startsWith("/api/auth") ||
        pathname.startsWith("/api/chat") ||
        pathname.startsWith("/api/health") ||
          pathname.startsWith("/api/payment") ||
          pathname.startsWith("/_next") ||
          pathname === "/" ||
          pathname === "/login" ||
          pathname === "/signup" ||
          pathname.startsWith("/reset-password") ||
          publicRoutes.some((r) => pathname.startsWith(r))
        ) {
          return true;
        }

        return !!token;
      },
    },
  },
);

function addSecurityHeaders(response: NextResponse, requestId?: string): NextResponse {
  if (requestId) response.headers.set("X-Request-ID", requestId);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  response.headers.set("Content-Security-Policy", getCSPHeader());
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};
