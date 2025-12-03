import { ArticleReader } from "@/components/reader/ArticleReader";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";
import { getArticleById } from "@/lib/articles";
import { notFound } from "next/navigation";

export const revalidate = 3600; // Revalidate every hour

export default async function ReadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const articleData = await getArticleById(id);

  if (!articleData) {
    notFound();
  }

  const article = {
    title: articleData.topic_title,
    content: articleData.article_markdown,
    date: articleData.date_str,
    readTime: articleData.reading_time_minutes,
    category: articleData.category,
    youtube: articleData.youtube,
    papers: articleData.papers,
  };
  
  return (
    <main className="relative min-h-screen bg-background text-foreground transition-colors duration-500">
      <ThemeSwitcher />
      <ArticleReader article={article} />
    </main>
  );
}
