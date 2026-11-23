"use client";

import { useEffect, useState } from "react";
import UploadZone from "../components/UploadZone";
import ChatZone from "../components/ChatZone";
import { analyzePhotos, resetBotanicalContext } from "../lib/api";
import type { Message, Photo, Stage } from "../lib/types";


const FLOWERS = ["🌻", "🌹", "🌼", "🌷"] as const;
const INITIAL_FLOWERS = ["🌸", "🌷", "🌻", "🌼", "🌹", "🌸"] as const;

export default function Home() {
  const [stage, setStage] = useState<Stage>("upload");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string>("");
  const [flowers, setFlowers] = useState<string[]>([...INITIAL_FLOWERS]);


  useEffect(() => {
    setFlowers(
      Array.from({ length: 6 }, () => FLOWERS[Math.floor(Math.random() * FLOWERS.length)])
    );
  }, []);


  async function handleSubmit() {
    setError("");
    setStage("analyzing");
    try {
      const reply = await analyzePhotos(photos.map((p) => p.file));
      setMessages([{ role: "assistant", content: reply }]);
      setStage("chat");
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Something went wrong while looking at your photos. Try again."
      );
      setStage("upload");
    }
  }

  function handleReset() {
    photos.forEach((p) => URL.revokeObjectURL(p.url));
    resetBotanicalContext();
    setPhotos([]);
    setMessages([]);
    setError("");
    setStage("upload");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-160 flex-col gap-6 px-5 pb-8 pt-6">
      <header className="flex items-center gap-2.5 self-center">
        {flowers.slice(0, 3).map((flower, idx) => (
          <span key={`left-${idx}`} className="text-[1.6rem]" aria-hidden="true">
            {flower}
          </span>
        ))}
        <h1 className="font-display text-[1.75rem] font-semibold text-forest">buotany</h1>
        {flowers.slice(3, 6).map((flower, idx) => (
          <span key={`right-${idx}`} className="text-[1.6rem]" aria-hidden="true">
            {flower}
          </span>
        ))}
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