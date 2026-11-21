import client from "@/lib/mongodb";

export type StartupMailKind = "account" | "payment" | "renewal" | "payment-failed" | "cancelled" | "suspended" | "expired" | "refund";

export async function queueStartupMail(id: string, kind: StartupMailKind, email: string) {
  const outbox = (await client).db("dailicle").collection<{ _id: string; kind: StartupMailKind; email: string; status: string; created_at: Date; next_at: Date }>("startup_email_outbox");
  const now = new Date();
  await outbox.updateOne({ _id: id }, { $setOnInsert: { kind, email, status: "pending", created_at: now, next_at: now } }, { upsert: true });
}
