import { ArchiveList } from "@/components/archive/ArchiveList";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";
import { getArticles } from "@/lib/articles";

export const revalidate = 3600; // Revalidate every hour

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const { page, q } = await searchParams;
  const currentPage = Number(page) || 1;
  const searchQuery = q || "";
  
  const { articles, totalPages } = await getArticles(currentPage, 10, searchQuery);

  return (
    <main className="relative min-h-screen bg-background text-foreground transition-colors duration-500">
      <ThemeSwitcher />
      <ArchiveList 
        initialArticles={articles} 
        totalPages={totalPages} 
        currentPage={currentPage}
        initialSearch={searchQuery}
      />
    </main>
  );
}
