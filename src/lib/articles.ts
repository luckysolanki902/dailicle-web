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
}

export async function getLatestArticle() {
  const client = await clientPromise;
  const db = client.db(DB_NAME);
  
  const article = await db
    .collection(COLLECTION)
    .find({})
    .sort({ date: -1 })
    .limit(1)
    .next();

  if (!article) return null;

  return {
    ...article,
    _id: article._id.toString(),
  } as Article;
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

  const articles = await db
    .collection(COLLECTION)
    .find(query)
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
