-- The collab end RPC has enqueued this job type since migration 050, but the
-- earlier mythic_graph_jobs CHECK constraint never allowed it.

begin;

alter table public.mythic_graph_jobs
  drop constraint if exists mythic_graph_jobs_job_type_check;

alter table public.mythic_graph_jobs
  add constraint mythic_graph_jobs_job_type_check
  check (job_type in (
    'create_mix_node',
    'create_submitted_to_edge',
    'derive_similarity_edges',
    'generate_node_embeddings',
    'recalculate_quest_momentum',
    'backfill_user_graph',
    'collab_session_post_process'
  ));

commit;
