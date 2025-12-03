import { Hero } from "@/components/landing/Hero";
import { ValueProps } from "@/components/landing/ValueProps";
import { Sources } from "@/components/landing/Sources";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";
import { getLatestArticle } from "@/lib/articles";
import { getSecondsUntil9AMIST } from "@/lib/cache";

export const revalidate = getSecondsUntil9AMIST(); // Auto-clear cache at 9 AM IST, otherwise 1 hour

export default async function Home() {
  const latestArticle = await getLatestArticle();

  // Fallback if no article found (e.g. DB empty)
  const todayTopic = latestArticle ? {
    id: latestArticle._id,
    title: latestArticle.topic_title,
    teaser: latestArticle.topic_rationale,
    readTime: latestArticle.reading_time_minutes,
  } : {
    id: "#",
    title: "No Article Today",
    teaser: "The ink is dry. Come back tomorrow.",
    readTime: 0,
  };

  return (
    <main className="relative min-h-screen bg-background text-foreground transition-colors duration-500">
      <ThemeSwitcher />
      <Hero todayTopic={todayTopic} />
      <Sources />
      <ValueProps />
      
      {/* Footer CTA */}
      <section className="py-32 px-6 text-center bg-foreground/5">
        <div className="max-w-2xl mx-auto space-y-6">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight">Ready to think deeper?</h2>
          <p className="text-xl text-foreground/70">
            Join thousands who start their day with insight.
            <br />
            <span className="text-base text-foreground/50">No signup. No spam. Just wisdom.</span>
          </p>
          <div className="pt-6">
            <a 
              href={`/read/${todayTopic.id}`}
              className="inline-flex items-center gap-2 px-10 py-5 bg-foreground text-background rounded-full text-lg font-semibold hover:scale-105 transition-transform shadow-lg"
            >
              Start Reading Today
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
