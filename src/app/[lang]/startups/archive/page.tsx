import Link from "next/link";
import { redirect } from "next/navigation";
import { startupHref, startupPath } from "@/i18n/startups";
import { startupIndex } from "@/lib/startup-essays";

export const dynamic = "force-dynamic";
export const metadata = { title: "Startups Archive", alternates: { canonical: startupHref("archive") } };

export default async function StartupArchive({ params, searchParams }: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ q?: string; sort?: string }>;
}) {
  if ((await params).lang !== "en") redirect(startupHref("archive"));
  const search = await searchParams;
  const query = typeof search.q === "string" ? search.q.trim().slice(0, 120) : "";
  const oldest = search.sort === "oldest";
  const rows = (await startupIndex()).filter((essay) =>
    `${essay.title} ${essay.dek}`.toLowerCase().includes(query.toLowerCase()));
  if (oldest) rows.reverse();
  const date = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "Asia/Kolkata" });

  return (
    <div className="mx-auto max-w-3xl py-14 sm:py-20">
      <header className="mb-8">
        <h1 className="font-serif text-5xl tracking-tight sm:text-6xl">Startups Archive</h1>
        <p className="mt-4 max-w-xl text-lg text-foreground/70">Essays on getting customers and building a company.</p>
      </header>
          <form action={startupPath("archive")} className="flex flex-wrap items-end gap-3 border-b border-foreground/15 pb-5">
            <label className="flex min-w-40 flex-1 flex-col gap-1 text-sm">
              Search essays
              <input name="q" type="search" defaultValue={query} className="rounded-lg border border-foreground/25 bg-transparent px-3 py-2" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Sort by
              <select name="sort" defaultValue={oldest ? "oldest" : "newest"} className="rounded-lg border border-foreground/25 bg-background px-3 py-2">
                <option value="newest">Newest first</option><option value="oldest">Oldest first</option>
              </select>
            </label>
            <button className="rounded-lg border border-foreground/25 px-4 py-2 text-sm">Apply</button>
          </form>
          <ul className="divide-y divide-foreground/15">
            {rows.map((essay) => (
              <li key={essay._id}>
                <Link href={startupPath(essay.slug)} className="group block py-6">
                  <p className="text-sm text-foreground/60">{date.format(essay.published_at)}</p>
                  <h2 className="mt-2 font-serif text-2xl group-hover:underline underline-offset-4">{essay.title}</h2>
                  <p className="mt-2 max-w-xl text-foreground/70">{essay.dek}</p>
                </Link>
              </li>
            ))}
          </ul>
          {!rows.length && <p className="mt-6 text-foreground/70">{query ? "No essays match your search." : "There are no essays in the archive yet."}</p>}
    </div>
  );
}
