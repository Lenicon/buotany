export type Stage = "upload" | "analyzing" | "chat";

export type Photo = {
  id: string;
  file: File;
  url: string; // object URL for previews
};

export type Message = {
  role: "user" | "assistant";
  content: string;
};