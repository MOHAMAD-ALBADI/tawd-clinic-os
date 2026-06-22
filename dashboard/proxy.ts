import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ROLE_HOME } from "@/lib/auth/role-redirect";
import type { Role } from "@/types/tawd";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cs) =>
          cs.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          ),
      },
    }
  );

  // getClaims() verifies the JWT locally (cached JWKS) — no per-request
  // network round-trip to the auth server, unlike getUser().
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const role = (claims?.app_metadata?.role ?? "clinic_admin") as Role;
  const path = request.nextUrl.pathname;

  // If on login page and already authenticated → redirect to role home
  if (path.startsWith("/login")) {
    if (claims) {
      return NextResponse.redirect(new URL(ROLE_HOME[role], request.url));
    }
    return response;
  }

  // If not authenticated → redirect to login
  if (!claims) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Root → redirect to role home
  if (path === "/") {
    return NextResponse.redirect(new URL(ROLE_HOME[role], request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
