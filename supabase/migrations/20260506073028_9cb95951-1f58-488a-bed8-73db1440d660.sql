
CREATE OR REPLACE FUNCTION public.search_knowledge(query_text TEXT, match_count INT DEFAULT 4)
RETURNS TABLE(id UUID, title TEXT, content TEXT, rank REAL)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT id, title, content, ts_rank(search_tsv, plainto_tsquery('english', query_text)) AS rank
  FROM public.knowledge_snippets
  WHERE search_tsv @@ plainto_tsquery('english', query_text)
  ORDER BY rank DESC
  LIMIT match_count;
$$;
