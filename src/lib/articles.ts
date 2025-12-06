import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";

const DB_NAME = "dailicle";
const COLLECTION = "articles";

export interface Resource {
  title: string;
  url: string;
  channel?: string;
  summary?: string;
  authors?: string;
  year?: number;
}

export interface Article {
  _id: string;
  topic_title: string;
  topic_rationale: string;
  category: string;
  tags: string[];
  article_markdown: string;
  estimated_wordcount: number;
  reading_time_minutes: number;
  date: Date;
  date_str: string;
  youtube?: Resource[];
  papers?: Resource[];
  // Audio fields
  audio_url?: string;
  audio_s3_key?: string;
  audio_voice?: string;
  audio_duration_seconds?: number;
  audio_generated_at?: Date;
}

export async function getLatestArticle() {
  const client = await clientPromise;
  const db = client.db(DB_NAME);
  
  // Only fetch fields needed for hero display
  const article = await db
    .collection(COLLECTION)
    .find({}, {
      projection: {
        _id: 1,
        topic_title: 1,
        topic_rationale: 1,
        reading_time_minutes: 1,
        date: 1,
        date_str: 1,
        // Exclude heavy fields like article_markdown
      }
    })
    .sort({ date: -1 })
    .limit(1)
    .next();

  if (!article) return null;

  return {
    ...article,
    _id: article._id.toString(),
  } as Article;
}

/**
 * Get the two most recent articles for time-based display logic.
 * The client will decide which to show based on local 9 AM threshold.
 */
export async function getLatestTwoArticles() {
  const client = await clientPromise;
  const db = client.db(DB_NAME);
  
  const articles = await db
    .collection(COLLECTION)
    .find({}, {
      projection: {
        _id: 1,
        topic_title: 1,
        topic_rationale: 1,
        reading_time_minutes: 1,
        date: 1,
        date_str: 1,
      }
    })
    .sort({ date: -1 })
    .limit(2)
    .toArray();

  return articles.map(doc => ({
    ...doc,
    _id: doc._id.toString(),
  })) as Article[];
}

export async function getArticleById(id: string) {
  const client = await clientPromise;
  const db = client.db(DB_NAME);
  
  try {
    const article = await db
      .collection(COLLECTION)
      .findOne({ _id: new ObjectId(id) });

    if (!article) return null;

    return {
      ...article,
      _id: article._id.toString(),
    } as Article;
  } catch (error) {
    console.error("Failed to fetch article:", error);
    return null;
  }
}

export async function getArticles(page = 1, limit = 10, search = "") {
  const client = await clientPromise;
  const db = client.db(DB_NAME);
  
  const skip = (page - 1) * limit;
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = {};
  
  if (search) {
    // Simple regex search for now (Atlas Search is better for prod)
    query = {
      $or: [
        { topic_title: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
        { tags: { $regex: search, $options: "i" } },
      ]
    };
  }

  // Only fetch fields needed for list view, not the full article_markdown
  const articles = await db
    .collection(COLLECTION)
    .find(query, {
      projection: {
        _id: 1,
        topic_title: 1,
        topic_rationale: 1,
        category: 1,
        tags: 1,
        estimated_wordcount: 1,
        reading_time_minutes: 1,
        date: 1,
        date_str: 1,
        // Exclude article_markdown, youtube, and papers for performance
      }
    })
    .sort({ date: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();

  const total = await db.collection(COLLECTION).countDocuments(query);

  return {
    articles: articles.map(doc => ({ ...doc, _id: doc._id.toString() })) as Article[],
    totalPages: Math.ceil(total / limit),
    currentPage: page,
  };
}
