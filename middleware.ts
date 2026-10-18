import { NextRequest, NextResponse } from "next/server";

// HTTP Basic Auth for the jury. Credentials come from JURY_USER / JURY_PASS env vars.
export function middleware(req: NextRequest) {
  const user = process.env.JURY_USER;
  const pass = process.env.JURY_PASS;
  if (!user || !pass) return NextResponse.next();
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    const [u, ...rest] = atob(auth.slice(6)).split(":");
    if (u === user && rest.join(":") === pass) return NextResponse.next();
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="SWITCHYARD"' },
  });
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health).*)"] };
