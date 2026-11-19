"use client";

import { useEffect, useRef, useState } from "react";
import type { Dispatch, SubmitEvent, SetStateAction } from "react";
import { sendMessage } from "../lib/api";
import type { Message, Photo } from "../lib/types";
import { btnPrimary } from "../lib/styles";

type ChatZoneProps = {
    photos: Photo[];
    messages: Message[];
    setMessages: Dispatch<SetStateAction<Message[]>>;
    onReset: () => void;
};

export default function ChatZone({
    photos,
    messages,
    setMessages,
    onReset,
}: ChatZoneProps) {
    const [input, setInput] = useState<string>("");
    const [sending, setSending] = useState<boolean>(false);
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, [messages, sending]);

    async function handleSend(e: SubmitEvent<HTMLFormElement>) {
        e.preventDefault();
        const text = input.trim();
        if (!text || sending) return;

        const history: Message[] = [...messages, { role: "user", content: text }];
        setMessages(history);
        setInput("");
        setSending(true);

        try {
            const reply = await sendMessage(history, photos.map((p) => p.file));
            setMessages([...history, { role: "assistant", content: reply }]);
        } catch {
            setMessages([
                ...history,
                { role: "assistant", content: "I couldn’t answer that one. Try sending it again." },
            ]);
        } finally {
            setSending(false);
        }
    }

    return (
        <section className="flex min-h-0 flex-1 flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
                <ul className="flex gap-2 overflow-x-auto">
                    {photos.map((p) => (
                        <li key={p.id} className="size-13 flex-none overflow-hidden rounded-2xl border-2 border-leaf">
                            <img src={p.url} alt="Your plant" className="block h-full w-full object-cover" />
                        </li>
                    ))}
                </ul>
                <button type="button" className="cursor-pointer whitespace-nowrap rounded-full border-2 border-bloom px-4.5 py-2 font-bold text-bloom-deep hover:bg-petal" onClick={onReset}>
                    New photos
                </button>
            </div>

            <div className="flex max-h-[60dvh] min-h-80 flex-1 flex-col gap-2.5 overflow-y-auto rounded-[28px] border-2 border-petal bg-white p-4" aria-live="polite">
                {messages.map((m, i) => (
                    <div key={i} className={`max-w-[85%] whitespace-pre-wrap rounded-[20px] px-4 py-2.5 wrap-anywhere ${m.role === "assistant"
                            ? "self-start rounded-bl-md bg-mint"
                            : "self-end rounded-br-md bg-petal"
                        }`}>
                        {m.content}
                    </div>
                ))}
                {sending && <div className="max-w-[85%] self-start rounded-[20px] rounded-bl-md bg-mint px-4 py-2.5 tracking-[0.2em] opacity-70">…</div>}
                <div ref={endRef} />
            </div>

            <form className="flex gap-2.5" onSubmit={handleSend}>
                <input
                    className="min-w-0 flex-1 rounded-full border-2 border-bloom bg-white px-5 py-3 placeholder:text-[#b08a98]"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask about watering, light, pests…"
                    aria-label="Your message"
                />
                <button type="submit" className={btnPrimary} disabled={!input.trim() || sending}>
                    Send
                </button>
            </form>
        </section>
    );
}