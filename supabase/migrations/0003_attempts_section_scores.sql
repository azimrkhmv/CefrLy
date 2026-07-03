-- Per-part score breakdown, e.g. {"1": {"correct": 5, "total": 6}, ...}
alter table public.attempts add column section_scores jsonb;
