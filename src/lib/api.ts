import type { Message } from "./types";

let latestContextToken = "";

export function resetBotanicalContext(): void {
  latestContextToken = "";
}

// Helper if backend wants base64 instead of raw files.
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// Called once after photos are submitted.
// Return the assistant's first message.
export async function analyzePhotos(files: File[]): Promise<string> {
  const formData = new FormData();
  for (const file of files) {
    formData.append("images", file);
  }

  const res = await fetch("/api/diagnose", {
    method: "POST",
    body: formData,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Diagnosis failed (HTTP ${res.status}).`);
  }

  latestContextToken =
    typeof data.contextToken === "string" ? data.contextToken : "";
  return data.diagnosis;
}

// Called for every chat message after that.
// `messages` is the full history, `files` is the original photo list.
// Return the assistant's reply.
export async function sendMessage(
  messages: Message[],
  _files: File[],
): Promise<string> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages,
      contextToken: latestContextToken,
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Chat request failed (HTTP ${res.status}).`);
  }

  return data.reply;
}
