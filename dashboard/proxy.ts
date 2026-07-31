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

  /* Public routes: anything a person who is not staff has to be able to open,
     plus api routes (which authenticate themselves and return JSON).

     /pay is where the payment gateway returns the PATIENT after paying. It was
     gated, so a patient who had just paid was shown a staff login screen — the
     worst possible moment to look broken.

     /legal has to be reachable by anyone, including Meta's app reviewer. A
     privacy policy behind a login is a privacy policy nobody can check, and the
     review is refused for exactly that. */
  const PUBLIC_PREFIXES = ["/book", "/auth", "/pay", "/legal"];

  /* The company site. It lives at the root and is open to everyone —
     including staff who are already signed in. Redirecting a signed-in visitor
     away from the homepage would mean the company's own site is unreachable to
     the people who work here, and to anyone we hand the link to. The header's
     "دخول" button is how they get to their dashboard. */
  const SITE_PREFIXES = [
    "/products", "/solutions", "/ai", "/integrations", "/security",
    "/resources", "/company", "/early-access", "/pricing", "/contact",
    /* old URLs, kept alive by redirects in next.config */
    "/product", "/faq", "/about",
  ];

  const isPublic =
    path.startsWith("/api/") ||
    path === "/" ||
    /* Gating these sends a crawler a login redirect instead of the file, and a
       sitemap nobody can fetch is a sitemap that does not exist. */
    path === "/sitemap.xml" ||
    path === "/robots.txt" ||
    SITE_PREFIXES.some((x) => path === x || path.startsWith(x + "/")) ||
    PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));
  if (isPublic) return response;

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
