import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

/**
 * On-demand ISR revalidation, called by the admin after a banner change so the
 * public pages update immediately instead of waiting out their revalidate
 * window. Guarded by a shared secret.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  const body = (await req.json().catch(() => ({}))) as {
    secret?: string;
    paths?: string[];
  };

  if (!secret || body.secret !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const paths = Array.isArray(body.paths) ? body.paths.slice(0, 20) : [];
  for (const p of paths) {
    if (typeof p === "string" && p.startsWith("/")) {
      revalidatePath(p);
    }
  }
  return NextResponse.json({ ok: true, revalidated: paths });
}
