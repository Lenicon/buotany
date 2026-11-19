import type { Message } from "./types";

// ─────────────────────────────────────────────────────────────
// Plug your own logic in here. The UI only depends on these two
// functions, so nothing else needs to change.
// ─────────────────────────────────────────────────────────────

// Handy if your backend wants base64 instead of raw files.
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
  // TODO: replace with your own call
  await new Promise((r) => setTimeout(r, 1500));
  return `Placeholder reply for ${files.length} photo${files.length > 1 ? "s" : ""}. Wire up analyzePhotos() in lib/api.ts.`;
}

// Called for every chat message after that.
// `messages` is the full history, `files` is the original photo list.
// Return the assistant's reply.
export async function sendMessage(messages: Message[], files: File[]): Promise<string> {
  // TODO: replace with your own call
  await new Promise((r) => setTimeout(r, 800));
  return "Placeholder reply. Wire up sendMessage() in lib/api.ts.";
}