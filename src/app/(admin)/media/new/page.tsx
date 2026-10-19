import type { Metadata } from "next";
import Link from "next/link";
import { requireSuperadmin } from "@/lib/admin";
import { CreateForm } from "./create-form";

export const metadata: Metadata = { title: "New generation · Control Center" };

// Caption generation may try several AI models (up to 100 seconds in total) when Gemini is busy.
export const maxDuration = 120;

export default async function NewMediaPage() {
  const { user } = await requireSuperadmin();

  return (
    <div className="mx-auto max-w-xl">
      <Link href="/media" className="text-sm font-bold text-ink-2 hover:text-white">
        ← All media
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">New generation</h1>
      <p className="mt-1 mb-8 text-ink-3">
        Upload a photo and Gemini writes 5 captions in the vibe you pick. It&apos;s posted
        under your account and appears in the app&apos;s feed.
      </p>
      <CreateForm userId={user.id} />
    </div>
  );
}
