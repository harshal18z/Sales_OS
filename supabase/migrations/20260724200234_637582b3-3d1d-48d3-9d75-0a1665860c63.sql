
-- Delete AI-discovered leads that were created before source verification existed
-- (i.e. their ai_insight has no non-empty `sources` array and no `verified: true` flag).
WITH bad_leads AS (
  SELECT id, contact_id
  FROM public.leads
  WHERE source = 'ai_discovery'
    AND (
      ai_insight IS NULL
      OR NOT (ai_insight ? 'sources')
      OR jsonb_typeof(ai_insight->'sources') <> 'array'
      OR jsonb_array_length(COALESCE(ai_insight->'sources', '[]'::jsonb)) = 0
    )
    AND COALESCE((ai_insight->>'verified')::boolean, false) = false
    AND COALESCE(ai_insight->>'status', '') <> 'needs_enrichment'
),
deleted_leads AS (
  DELETE FROM public.leads
  WHERE id IN (SELECT id FROM bad_leads)
  RETURNING contact_id
)
DELETE FROM public.contacts c
USING deleted_leads d
WHERE c.id = d.contact_id
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.contact_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.crm_deals dl WHERE dl.lead_id IS NOT NULL AND dl.company_id = c.company_id AND dl.lead_id IN (SELECT id FROM public.leads WHERE contact_id = c.id));
