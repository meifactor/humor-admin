import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ConfirmButton } from "@/components/confirm-button";
import { panelClass } from "@/components/ui";
import { requireSuperadmin } from "@/lib/admin";
import { formatDateTime } from "@/lib/format";
import { fullName, uploadUrl } from "@/lib/storage";
import { deleteImage } from "./actions";
import { ImageUpload } from "./image-upload";

export const metadata: Metadata = { title: "Images · Control Center" };

type ImageRow = {
  path: string;
  size_bytes: number;
  mime_type: string | null;
  created_at: string;
  owner_id: string | null;
  owner_first_name: string | null;
  owner_last_name: string | null;
  generation_id: string | null;
};

function formatSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// CREATE/READ/UPDATE/DELETE the photos in the "uploads" Storage bucket.
export default async function ImagesPage() {
  const { supabase, user } = await requireSuperadmin();
  const { data, error } = await supabase.rpc("admin_list_images");
  const images = (data as ImageRow[] | null) ?? [];
  const unused = images.filter((i) => !i.generation_id).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Images</h1>
          <p className="mt-1 max-w-3xl text-ink-3">
            {images.length} uploaded photos ({unused} not used by any caption post). Photos are stored in
            Supabase Storage; the database only stores their paths. To caption an upload, use{" "}
            <Link href="/media/new" className="font-bold underline">
              New generation
            </Link>
            .
          </p>
        </div>
        <ImageUpload userId={user.id} />
      </div>

      {error ? (
        <p className="rounded-md border border-mta-red p-4 text-red-300">
          Could not load images: {error.message}. Has <code>supabase/observability.sql</code> been run?
        </p>
      ) : images.length === 0 ? (
        <p className={`${panelClass} p-6 text-ink-3`}>No images uploaded yet.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((image) => (
            <li key={image.path} className={`${panelClass} overflow-hidden`}>
              <a href={uploadUrl(image.path)} target="_blank" rel="noreferrer" className="relative block aspect-[4/3] bg-black">
                <Image src={uploadUrl(image.path)} alt="Uploaded photo" fill unoptimized className="object-contain" />
              </a>
              <div className="space-y-2 p-4 text-sm">
                <p className="truncate font-mono text-xs text-ink-3" title={image.path}>
                  {image.path}
                </p>
                <p className="text-ink-2">
                  {image.owner_id ? fullName({ first_name: image.owner_first_name, last_name: image.owner_last_name }) : "Unknown"} ·{" "}
                  {formatSize(image.size_bytes)} · {formatDateTime(image.created_at)}
                </p>
                <p>
                  {image.generation_id ? (
                    <Link href={`/media/${image.generation_id}`} className="font-bold text-ink-2 hover:text-white">
                      Used by a caption post →
                    </Link>
                  ) : (
                    <span className="text-ink-3">Not used by any post</span>
                  )}
                </p>
                <div className="flex flex-wrap items-start gap-2 pt-1">
                  <ImageUpload userId={user.id} replacePath={image.path} />
                  {image.generation_id ? (
                    <span className="py-1 text-xs text-ink-3">Delete its post in Media to remove it.</span>
                  ) : (
                    <form action={deleteImage}>
                      <input type="hidden" name="path" value={image.path} />
                      <ConfirmButton label="Delete" confirmText="Delete this image? This can't be undone." compact />
                    </form>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
