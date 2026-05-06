import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { sendMessage, clearChat } from "@/server/chat.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, BookPlus, Trash2, Sparkles, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/")({ component: Index });

type Msg = { id: string; role: string; content: string; sources?: any };
type Snippet = { id: string; title: string | null; content: string; created_at: string };

function Index() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [snipTitle, setSnipTitle] = useState("");
  const [snipContent, setSnipContent] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const send = useServerFn(sendMessage);
  const clear = useServerFn(clearChat);

  async function loadAll() {
    const [m, s] = await Promise.all([
      supabase.from("messages").select("*").order("created_at"),
      supabase.from("knowledge_snippets").select("*").order("created_at", { ascending: false }),
    ]);
    setMessages((m.data as Msg[]) ?? []);
    setSnippets((s.data as Snippet[]) ?? []);
  }

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);
    setMessages((p) => [...p, { id: crypto.randomUUID(), role: "user", content: text }]);
    try {
      await send({ data: { message: text } });
      await loadAll();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to send");
    } finally {
      setSending(false);
    }
  }

  async function addSnippet() {
    if (!snipContent.trim()) return;
    const { error } = await supabase
      .from("knowledge_snippets")
      .insert({ title: snipTitle.trim() || null, content: snipContent.trim() });
    if (error) return toast.error(error.message);
    setSnipTitle("");
    setSnipContent("");
    toast.success("Added to knowledge base");
    loadAll();
  }

  async function delSnippet(id: string) {
    await supabase.from("knowledge_snippets").delete().eq("id", id);
    loadAll();
  }

  async function handleClear() {
    await clear({});
    setMessages([]);
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster />
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 p-4 md:grid-cols-[1fr_22rem] md:p-6">
        {/* Chat */}
        <Card className="flex h-[calc(100vh-3rem)] flex-col overflow-hidden">
          <header className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h1 className="font-semibold">RAG Chat Agent</h1>
            </div>
            <Button variant="ghost" size="sm" onClick={handleClear}>
              <Trash2 className="mr-1 h-4 w-4" /> Clear
            </Button>
          </header>

          <div ref={scrollRef} className="flex-1 overflow-y-auto">
            <div className="space-y-4 p-4">
              {messages.length === 0 && (
                <div className="py-16 text-center text-sm text-muted-foreground">
                  Ask anything. Add snippets on the right to ground answers in your knowledge base.
                </div>
              )}
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {m.content}
                    {m.sources && Array.isArray(m.sources) && m.sources.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1 border-t border-border/40 pt-2 text-xs opacity-80">
                        {m.sources.map((s: any, i: number) => (
                          <span key={s.id} className="rounded bg-background/50 px-1.5 py-0.5">
                            [{i + 1}] {s.title ?? "Untitled"}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="text-sm text-muted-foreground">Thinking…</div>
              )}
            </div>
          </div>

          <form onSubmit={handleSend} className="flex gap-2 border-t p-3">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question…"
              disabled={sending}
            />
            <Button type="submit" disabled={sending || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </Card>

        {/* Knowledge Base */}
        <Card className="flex h-[calc(100vh-3rem)] flex-col overflow-hidden">
          <header className="flex items-center gap-2 border-b px-4 py-3">
            <BookOpen className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Knowledge Base</h2>
            <span className="ml-auto text-xs text-muted-foreground">{snippets.length}</span>
          </header>
          <div className="space-y-2 border-b p-3">
            <Input
              placeholder="Title (optional)"
              value={snipTitle}
              onChange={(e) => setSnipTitle(e.target.value)}
            />
            <Textarea
              placeholder="Paste a text snippet…"
              value={snipContent}
              onChange={(e) => setSnipContent(e.target.value)}
              rows={4}
            />
            <Button onClick={addSnippet} disabled={!snipContent.trim()} className="w-full">
              <BookPlus className="mr-1 h-4 w-4" /> Add snippet
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="space-y-2 p-3">
              {snippets.length === 0 && (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  No snippets yet.
                </p>
              )}
              {snippets.map((s) => (
                <div key={s.id} className="group rounded-lg border bg-card p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium">{s.title ?? "Untitled"}</div>
                    <button
                      onClick={() => delSnippet(s.id)}
                      className="opacity-0 transition group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                  <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{s.content}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </Card>
      </div>
    </div>
  );
}
