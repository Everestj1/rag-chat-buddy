import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function admin() {
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const sendMessage = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ message: z.string().min(1).max(4000) }).parse(d))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");
    const sb = admin();

    // 1. Save user message
    await sb.from("messages").insert({ role: "user", content: data.message });

    // 2. Retrieve relevant knowledge (RAG)
    const { data: snippets } = await sb.rpc("search_knowledge", {
      query_text: data.message,
      match_count: 4,
    });
    const sources = (snippets ?? []).map((s) => ({ id: s.id, title: s.title }));
    const context = (snippets ?? [])
      .map((s, i) => `[${i + 1}] ${s.title ?? "Untitled"}\n${s.content}`)
      .join("\n\n");

    // 3. Get last 10 messages for conversation memory
    const { data: history } = await sb
      .from("messages")
      .select("role, content")
      .order("created_at", { ascending: false })
      .limit(10);
    const convo = (history ?? []).reverse();

    const systemPrompt = `You are a helpful assistant. Answer using the knowledge base context below when relevant. If the context is empty or doesn't contain the answer, rely on your general knowledge but say so. Cite sources using [1], [2], etc. when you use them.

KNOWLEDGE BASE CONTEXT:
${context || "(no relevant snippets found)"}`;

    // 4. Call Lovable AI
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...convo.map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    });

    if (!res.ok) {
      if (res.status === 429) throw new Error("Rate limit exceeded. Please try again shortly.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add funds in Settings → Workspace → Usage.");
      throw new Error(`AI error: ${res.status}`);
    }
    const json = await res.json();
    const reply: string = json.choices?.[0]?.message?.content ?? "(no response)";

    // 5. Save assistant message
    await sb.from("messages").insert({ role: "assistant", content: reply, sources });

    return { reply, sources };
  });

export const clearChat = createServerFn({ method: "POST" }).handler(async () => {
  await admin().from("messages").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  return { ok: true };
});
