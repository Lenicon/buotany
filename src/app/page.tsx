"use client";

import { useState } from "react";
import UploadZone from "../components/UploadZone";
import ChatZone from "../components/ChatZone";
import { analyzePhotos } from "../lib/api";
import type { Message, Photo, Stage } from "../lib/types";


export default function Home() {
  const [stage, setStage] = useState<Stage>("upload");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string>("");

  async function handleSubmit() {
    setError("");
    setStage("analyzing");
    try {
      const reply = await analyzePhotos(photos.map((p) => p.file));
      setMessages([{ role: "assistant", content: reply }]);
      setStage("chat");
    } catch {
      setError("Something went wrong while looking at your photos. Try again.");
      setStage("upload");
    }
  }

  function handleReset() {
    photos.forEach((p) => URL.revokeObjectURL(p.url));
    setPhotos([]);
    setMessages([]);
    setError("");
    setStage("upload");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-160 flex-col gap-6 px-5 pb-8 pt-6">
      <header className="flex items-center gap-2.5">
        <span className="text-[1.6rem]" aria-hidden="true">🌱</span>
        <h1 className="font-display text-[1.75rem] font-semibold text-forest">Buotany</h1>
      </header>

      {stage !== "chat" && (
        <UploadZone
          photos={photos}
          setPhotos={setPhotos}
          onSubmit={handleSubmit}
          loading={stage === "analyzing"}
          error={error}
        />
      )}

      {stage === "chat" && (
        <ChatZone
          photos={photos}
          messages={messages}
          setMessages={setMessages}
          onReset={handleReset}
        />
      )}
    </main>
  );
}