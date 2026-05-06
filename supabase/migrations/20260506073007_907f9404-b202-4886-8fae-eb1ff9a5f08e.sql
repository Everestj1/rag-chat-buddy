
-- Knowledge snippets for RAG
CREATE TABLE public.knowledge_snippets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  content TEXT NOT NULL,
  search_tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(title,'') || ' ' || content)) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX knowledge_snippets_tsv_idx ON public.knowledge_snippets USING GIN (search_tsv);

ALTER TABLE public.knowledge_snippets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read snippets" ON public.knowledge_snippets FOR SELECT USING (true);
CREATE POLICY "public insert snippets" ON public.knowledge_snippets FOR INSERT WITH CHECK (true);
CREATE POLICY "public delete snippets" ON public.knowledge_snippets FOR DELETE USING (true);

-- Chat messages (single shared conversation)
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  sources JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read messages" ON public.messages FOR SELECT USING (true);
CREATE POLICY "public insert messages" ON public.messages FOR INSERT WITH CHECK (true);
CREATE POLICY "public delete messages" ON public.messages FOR DELETE USING (true);

-- RAG search function: returns top matching snippets via full-text search with fallback to recency
CREATE OR REPLACE FUNCTION public.search_knowledge(query_text TEXT, match_count INT DEFAULT 4)
RETURNS TABLE(id UUID, title TEXT, content TEXT, rank REAL)
LANGUAGE sql STABLE AS $$
  SELECT id, title, content, ts_rank(search_tsv, plainto_tsquery('english', query_text)) AS rank
  FROM public.knowledge_snippets
  WHERE search_tsv @@ plainto_tsquery('english', query_text)
  ORDER BY rank DESC
  LIMIT match_count;
$$;
