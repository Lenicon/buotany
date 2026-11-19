"use client";

import { useRef, useState } from "react";
import type { Dispatch, DragEvent, SetStateAction } from "react";
import type { Photo } from "../lib/types";
import { btnPrimary } from "../lib/styles";

const MAX_PHOTOS = 5;

type UploadZoneProps = {
  photos: Photo[];
  setPhotos: Dispatch<SetStateAction<Photo[]>>;
  onSubmit: () => void;
  loading: boolean;
  error: string;
};

export default function UploadZone({
  photos,
  setPhotos,
  onSubmit,
  loading,
  error,
}: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState<boolean>(false);
  const full = photos.length >= MAX_PHOTOS;

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    const images = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    const room = MAX_PHOTOS - photos.length;
    const next: Photo[] = images.slice(0, room).map((file) => ({
      id: crypto.randomUUID(),
      file,
      url: URL.createObjectURL(file),
    }));
    if (next.length) setPhotos([...photos, ...next]);
  }

  function removePhoto(id: string) {
    const target = photos.find((p) => p.id === id);
    if (target) URL.revokeObjectURL(target.url);
    setPhotos(photos.filter((p) => p.id !== id));
  }

  function onDrop(e: DragEvent<HTMLButtonElement>) {
    e.preventDefault();
    setDragging(false);
    if (!loading && !full) addFiles(e.dataTransfer.files);
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="mt-2 font-display text-4xl font-semibold leading-tight text-bloom-deep">Any little leaf problems?</h2>
      <p className="text-[1.05rem]">
        Add up to {MAX_PHOTOS} photos of the <strong>SAME PLANT</strong>, preferrably <strong>DIFFERENT ORGANS</strong>, and Buotany will take a look.
      </p>

      <button
        type="button"
        className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-4xl border-[3px] border-dashed px-5 py-10 text-center transition enabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 ${
          dragging
            ? "border-leaf bg-mint"
            : "border-bloom bg-petal enabled:hover:border-leaf enabled:hover:bg-mint"
        }`}
        disabled={loading || full}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <span className="text-[2.5rem]" aria-hidden="true">🌸</span>
        <span className="font-display text-xl font-medium text-forest">
          {full ? "That’s all five!" : "Drop photos here or tap to browse"}
        </span>
        <span className="text-sm opacity-75">
          {photos.length} of {MAX_PHOTOS} added
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {photos.length > 0 && (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-3">
          {photos.map((p) => (
            <li key={p.id} className="relative aspect-square overflow-hidden rounded-[20px] border-[3px] border-leaf bg-mint">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="Uploaded plant" className="block h-full w-full object-cover" />
              {!loading && (
                <button
                  type="button"
                  className="absolute right-1.5 top-1.5 flex size-6.5 cursor-pointer items-center justify-center rounded-full bg-bloom-deep text-lg leading-none text-white"
                  aria-label="Remove photo"
                  onClick={() => removePhoto(p.id)}
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="rounded-2xl bg-red-100 px-3.5 py-2.5 text-red-800" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        className={`${btnPrimary} self-start`}
        disabled={photos.length === 0 || loading}
        onClick={onSubmit}
      >
        {loading ? "Checking diagnosis..." : "Help my plant"}
      </button>
    </section>
  );
}