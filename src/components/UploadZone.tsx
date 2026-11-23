"use client";

import { useRef, useState } from "react";
import type { Dispatch, DragEvent, SetStateAction } from "react";
import type { Photo } from "../lib/types";
import { btnPrimary } from "../lib/styles";

const MAX_PHOTOS = 5;
const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg"]);
const ALLOWED_EXTENSIONS = /\.(png|jpe?g)$/i;

function isAllowedImage(file: File): boolean {
    return ALLOWED_MIME_TYPES.has(file.type) || (!file.type && ALLOWED_EXTENSIONS.test(file.name));
}

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
    const [typeNotice, setTypeNotice] = useState<string>("");
    const full = photos.length >= MAX_PHOTOS;

    function addFiles(fileList: FileList | null) {
        if (!fileList) return;

        const allFiles = Array.from(fileList);
        const images = allFiles.filter(isAllowedImage);

        if (images.length < allFiles.length) {
            setTypeNotice("Only PNG and JPG/JPEG files are supported.");
        } else {
            setTypeNotice("");
        }

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
            <h2 className="mt-2 font-display text-4xl font-semibold text-center leading-tight text-bloom-deep">You got any <span className="text-forest/80">leaf problems?</span></h2>
            <p className="text-[1.05rem] text-center">
                Add up to <strong className="text-bloom-deep font-extrabold">{MAX_PHOTOS} PHOTOS</strong> of the <strong className="text-forest font-extrabold">SAME PLANT</strong>, preferrably <strong className="text-forest font-extrabold">DIFFERENT ORGANS</strong>, and <strong className="text-forest">buotany</strong> will take a look and diagnose your plant.
            </p>

            <button
                type="button"
                className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-4xl border-[3px] border-dashed px-5 py-10 text-center transition enabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 ${dragging
                    ? "border-leaf bg-mint text-forest"
                    : "border-bloom bg-petal text-bloom-deep enabled:hover:border-leaf enabled:hover:bg-mint enabled:hover:text-forest"
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
                <span className="text-[2.5rem]" aria-hidden="true">🌺</span>
                <span className="font-display text-xl font-medium">
                    {full ? "That’s all five!" : "Drop photos here or tap to browse"}
                </span>
                <span className="text-md opacity-75">
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

            {typeNotice && (
                <p className="rounded-2xl bg-amber-100 px-3.5 py-2 text-sm text-amber-900" role="status">
                    {typeNotice}
                </p>
            )}

            {photos.length > 0 && (
                <ul className="flex flex-wrap justify-center gap-3">
                    {photos.map((p) => (
                        <li key={p.id} className="size-24 group/photo relative aspect-square overflow-hidden rounded-[20px] border-3 border-bloom bg-bloom transition-colors has-[button:hover]:border-bloom-deep">
                            <img src={p.url} alt="Uploaded plant" className="block h-full w-full object-cover" />
                            {!loading && (
                                <button
                                    type="button"
                                    className="absolute -right-0.5 -top-0.5 flex size-12 cursor-pointer items-start justify-end bg-bloom pt-1 pr-2 font-black text-xl leading-none text-white [clip-path:polygon(0_0,100%_0,100%_100%)] transition-colors hover:bg-bloom-deep"
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
                className={`${btnPrimary} self-start w-full`}
                disabled={photos.length === 0 || loading}
                onClick={onSubmit}
            >
                {loading ? "Checking diagnosis..." : "Help my plant !"}
            </button>
        </section>
    );
}