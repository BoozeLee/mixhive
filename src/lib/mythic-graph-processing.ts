import { createServerClient } from './supabase';
import {
  get_mythic_graph_job,
  mark_mythic_graph_job_processing,
  mark_mythic_graph_job_complete,
  mark_mythic_graph_job_failed,
} from './database-queries';
import { computeCollabEdgeSignature } from './collabSignature';
import type { Json } from './database.types';

// ============================================================================
// Mythic Graph Processing Worker
// ============================================================================

export interface MythicGraphProcessingConfig {
  maxRetries: number;
  timeoutMs: number;
  embeddingModel?: string; // placeholder for future
}

export const MYTHIC_GRAPH_PROCESSING_CONFIG: MythicGraphProcessingConfig = {
  maxRetries: 3,
  timeoutMs: 120000, // 2 minutes per job
};

export class MythicGraphProcessingWorker {
  private config: MythicGraphProcessingConfig;

  constructor(config: MythicGraphProcessingConfig = MYTHIC_GRAPH_PROCESSING_CONFIG) {
    this.config = config;
  }

  /**
   * Main entry point - processes a single mythic graph job
   */
  async processJob(jobId: string): Promise<void> {
    const job = await get_mythic_graph_job(jobId);
    if (!job) {
      throw new Error(`Mythic graph job ${jobId} not found`);
    }

    try {
      await mark_mythic_graph_job_processing(jobId);

      const result = await this.executeJob(job);

      await mark_mythic_graph_job_complete(jobId, result as Json);
    } catch (error) {
      console.error(`Mythic graph job ${jobId} failed:`, error);

      const shouldRetry = job.retry_count < job.max_retries;
      await mark_mythic_graph_job_failed(
        jobId,
        error instanceof Error ? error.message : 'Unknown error',
        shouldRetry
      );

      if (!shouldRetry) {
        throw error;
      }
    }
  }

  /**
   * Route to the correct handler based on job_type
   */
  private async executeJob(job: {
    job_type: string;
    scope: Record<string, unknown>;
  }): Promise<unknown> {
    const { job_type: jobType, scope } = job;

    switch (jobType) {
      case 'create_mix_node':
        return await this.handleCreateMixNode(scope);

      case 'create_submitted_to_edge':
        return await this.handleCreateSubmittedToEdge(scope);

      case 'derive_similarity_edges':
        return await this.handleDeriveSimilarityEdges(scope);

      case 'generate_node_embeddings':
        return await this.handleGenerateNodeEmbeddings(scope);

      case 'recalculate_quest_momentum':
        return await this.handleRecalculateQuestMomentum(scope);

      case 'backfill_user_graph':
        return await this.handleBackfillUserGraph(scope);

      case 'collab_session_post_process':
        return await this.handleCollabSessionPostProcess(scope);

      default:
        throw new Error(`Unknown mythic graph job type: ${jobType}`);
    }
  }

  // --------------------------------------------------------------------------
  // Job Handlers
  // --------------------------------------------------------------------------

  private async handleCreateMixNode(scope: Record<string, unknown>): Promise<unknown> {
    const { mix_id } = scope;
    if (!mix_id) throw new Error('mix_id is required for create_mix_node');

    // Call the derivation function created in migration 043
    const supabase = createServerClient();
    const { data, error } = await supabase.rpc('derive_mix_node', {
      p_mix_id: mix_id,
    });

    if (error) throw error;

    return {
      node_id: data,
      message: 'Mix node and edges created',
    };
  }

  private async handleCreateSubmittedToEdge(scope: Record<string, unknown>): Promise<unknown> {
    const { user_id, opportunity_id, status } = scope;
    if (!user_id || !opportunity_id) {
      throw new Error('user_id and opportunity_id are required');
    }

    const supabase = createServerClient();
    await supabase.rpc('derive_opportunity_submission', {
      p_user_id: user_id,
      p_opportunity_id: opportunity_id,
      p_status: status || 'saved',
    });

    return { message: 'submitted_to edge created or updated' };
  }

  private async handleDeriveSimilarityEdges(scope: Record<string, unknown>): Promise<unknown> {
    const { user_id } = scope;
    if (!user_id) {
      throw new Error('user_id is required for derive_similarity_edges');
    }

    const supabase = createServerClient();

    // 1. Get the user's recent high-signal activity (last 12 months)
    const { data: userEdges } = await supabase
      .from('mythic_edges')
      .select('to_node_id, edge_type, weight, metadata')
      .eq('from_node_id', user_id) // simplistic — in reality we'd join to get owner
      .gte('occurred_at', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString())
      .in('edge_type', ['performed_at', 'collab_with', 'engaged_with']);

    if (!userEdges || userEdges.length === 0) {
      return { created_edges: 0, message: 'Not enough activity for similarity computation yet' };
    }

    // 2. Use the fast SQL RPC we created in migration 044
    const { data: overlappingArtists } = await supabase.rpc(
      'find_similar_artists_by_graph_overlap',
      {
        p_user_id: user_id,
        p_min_shared: 2,
        p_limit: 30,
        p_days_window: 365,
      }
    );

    const created: unknown[] = [];

    if (overlappingArtists && overlappingArtists.length > 0) {
      for (const candidate of overlappingArtists) {
        const sharedVenues = candidate.shared_venues || 0;
        const sharedEngagement = candidate.shared_mix_engagement || 0;

        // Stronger weighting now that we have better signals
        const compositeScore = Math.min(
          0.95,
          sharedVenues * 0.28 + sharedEngagement * 0.14 + 0.25 // base graph affinity
        );

        const { error } = await supabase.from('mythic_edges').upsert(
          {
            from_node_id: user_id,
            to_node_id: candidate.artist_node_id,
            edge_type: 'collab_with',
            weight: compositeScore,
            occurred_at: new Date().toISOString(),
            source_event: 'derive_similarity_edges:worker',
            metadata: {
              shared_venues: sharedVenues,
              shared_mix_engagement: sharedEngagement,
              total_shared_signals: candidate.total_shared_signals,
              computed_at: new Date().toISOString(),
              method: 'graph_overlap_v2',
            },
          },
          { onConflict: 'from_node_id,to_node_id,edge_type' }
        );

        if (!error) {
          created.push({
            to: candidate.artist_node_id,
            score: compositeScore,
            reasons: `${sharedVenues} shared venues, ${sharedEngagement} co-engagements`,
          });
        }
      }
    }

    return {
      created_edges: created.length,
      candidates_considered: overlappingArtists?.length || 0,
      top_matches: created.slice(0, 5),
    };
  }

  private async handleGenerateNodeEmbeddings(scope: Record<string, unknown>): Promise<unknown> {
    const { node_ids } = scope;
    if (!node_ids || !Array.isArray(node_ids)) {
      throw new Error('node_ids array is required');
    }

    const supabase = createServerClient();
    let embedded = 0;

    for (const nodeId of node_ids) {
      const { data: node } = await supabase
        .from('mythic_nodes')
        .select('title, payload, node_type')
        .eq('id', nodeId)
        .single();

      if (!node) continue;

      const textToEmbed = [
        node.title,
        node.node_type,
        JSON.stringify(node.payload || {}).slice(0, 800),
      ]
        .filter(Boolean)
        .join(' | ');

      if (textToEmbed.length < 10) continue;

      try {
        // Reuse the existing vector embedding infrastructure
        const embedding = await this.embedText(textToEmbed);

        await supabase
          .from('mythic_nodes')
          .update({ embedding: `[${embedding.join(',')}]` })
          .eq('id', nodeId);

        embedded++;
      } catch (err) {
        console.warn(`Failed to embed mythic node ${nodeId}:`, err);
      }
    }

    return { embedded_count: embedded, attempted: node_ids.length };
  }

  // Helper to generate embeddings using the project's existing OpenAI setup
  private async embedText(text: string): Promise<number[]> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text.slice(0, 8000),
      }),
    });

    if (!res.ok) throw new Error(`Embedding API failed: ${res.status}`);

    const data = (await res.json()) as { data: Array<{ embedding: number[] }> };
    return data.data[0].embedding;
  }

  private async handleRecalculateQuestMomentum(scope: Record<string, unknown>): Promise<unknown> {
    const { quest_id } = scope;
    if (!quest_id) throw new Error('quest_id is required');

    // Basic momentum heuristic (can be made much smarter later)
    const supabase = createServerClient();

    // Count recent evidence edges for this quest
    const { count } = await supabase
      .from('quest_milestone_evidence')
      .select('*', { count: 'exact', head: true })
      .eq('quest_id', quest_id);

    // Very naive momentum calculation for Phase 6
    const momentum = Math.min(95, 30 + (count || 0) * 8);

    // Update the quest
    await supabase
      .from('quests')
      .update({ momentum, updated_at: new Date().toISOString() })
      .eq('id', quest_id);

    return { quest_id, new_momentum: momentum };
  }

  private async handleCollabSessionPostProcess(scope: Record<string, unknown>): Promise<unknown> {
    const { session_id } = scope;
    if (!session_id) throw new Error('session_id is required for collab_session_post_process');

    const supabase = createServerClient();

    // 1. Get session and participants
    const { data: session } = await supabase
      .from('collab_sessions')
      .select('id, title, owner_id')
      .eq('id', session_id)
      .single();

    if (!session) {
      throw new Error('Session not found');
    }

    const { data: participants } = await supabase
      .from('collab_session_participants')
      .select('profile_id')
      .eq('session_id', session_id);

    if (!participants || participants.length < 2) {
      return { created_edges: 0, message: 'Not enough participants for collaboration edges' };
    }

    const profileIds = participants.map(p => p.profile_id);
    const created: unknown[] = [];

    // Sign the (DB-authoritative) participant set so each collab_with edge carries a
    // server-minted attestation. mythic_edges has no client write policy, so a present
    // signature proves the edge came from this trusted job. Same payload for every pair.
    const endedAt = new Date().toISOString();
    const signingSecret = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const collabSig = signingSecret
      ? computeCollabEdgeSignature(profileIds, session_id, endedAt, signingSecret)
      : null;

    // 2.5 Inspired_by from stems (if any were added during session)
    const stems = (session as { metadata?: { stems?: unknown[] } }).metadata?.stems || [];
    if (stems.length > 0) {
      // Create inspired_by edges from owner to a representative "stem activity" node or just log as activity
      // For simplicity, create an inspired_by edge type for the session activity
      const ownerNode = await supabase
        .from('mythic_nodes')
        .select('id')
        .eq('owner_id', session.owner_id)
        .eq('node_type', 'artist_profile')
        .single();

      if (ownerNode.data) {
        const { error: inspiredErr } = await supabase.from('mythic_edges').insert({
          from_node_id: ownerNode.data.id,
          to_node_id: ownerNode.data.id, // self or create a virtual stem node; for demo self-referential with metadata
          edge_type: 'inspired_by',
          weight: 0.7,
          occurred_at: new Date().toISOString(),
          source_event: `collab_session:${session_id}`,
          metadata: {
            session_id,
            stems: stems,
            generated_by: 'collab_session_post_process',
            note: 'Inspired by stems shared in this co-production session',
          },
        });

        if (!inspiredErr) {
          created.push({ type: 'inspired_by', based_on: stems.length + ' stems' });
        }
      }
    }

    // 2. Create collab edges between every pair of participants
    // Thanks to migration 049, artist_profile nodes should exist, but we remain defensive.
    for (let i = 0; i < profileIds.length; i++) {
      for (let j = i + 1; j < profileIds.length; j++) {
        const artistA = profileIds[i];
        const artistB = profileIds[j];

        // Get (or create if missing) their artist_profile nodes
        let { data: nodeA } = await supabase
          .from('mythic_nodes')
          .select('id')
          .eq('owner_id', artistA)
          .eq('node_type', 'artist_profile')
          .single();

        if (!nodeA) {
          // Fallback creation (should be rare thanks to 049 trigger)
          const { data: profileA } = await supabase
            .from('profiles')
            .select('username, display_name')
            .eq('id', artistA)
            .single();
          const { data: newNodeA } = await supabase
            .from('mythic_nodes')
            .insert({
              node_type: 'artist_profile',
              owner_id: artistA,
              title: profileA?.display_name || profileA?.username || 'Artist',
              source_table: 'profiles',
              source_id: artistA,
            })
            .select('id')
            .single();
          nodeA = newNodeA;
        }

        let { data: nodeB } = await supabase
          .from('mythic_nodes')
          .select('id')
          .eq('owner_id', artistB)
          .eq('node_type', 'artist_profile')
          .single();

        if (!nodeB) {
          const { data: profileB } = await supabase
            .from('profiles')
            .select('username, display_name')
            .eq('id', artistB)
            .single();
          const { data: newNodeB } = await supabase
            .from('mythic_nodes')
            .insert({
              node_type: 'artist_profile',
              owner_id: artistB,
              title: profileB?.display_name || profileB?.username || 'Artist',
              source_table: 'profiles',
              source_id: artistB,
            })
            .select('id')
            .single();
          nodeB = newNodeB;
        }

        if (!nodeA || !nodeB) continue;

        // Upsert collab_with edge as "proposed" (user must approve in review screen)
        const { error } = await supabase.from('mythic_edges').upsert(
          {
            from_node_id: nodeA.id,
            to_node_id: nodeB.id,
            edge_type: 'collab_with',
            weight: 0.85,
            occurred_at: new Date().toISOString(),
            source_event: `collab_session:${session_id}`,
            metadata: {
              session_id,
              session_title: session.title,
              generated_by: 'collab_session_post_process',
              created_at: new Date().toISOString(),
              status: 'proposed', // <-- Key field for review flow
              ...(collabSig ?? {}), // signature + signed_at + participant_count (when secret set)
            },
          },
          { onConflict: 'from_node_id,to_node_id,edge_type' }
        );

        if (!error) {
          created.push({
            from: artistA,
            to: artistB,
            type: 'collab_with',
          });
        }
      }
    }

    return {
      session_id,
      created_edges: created.length,
      edges: created,
      message: `Processed collab session. Created ${created.length} proposed collab_with edges (pending user approval).`,
    };
  }

  private async handleBackfillUserGraph(scope: Record<string, unknown>): Promise<unknown> {
    const { user_id } = scope;
    if (!user_id) throw new Error('user_id is required for backfill');

    const supabase = createServerClient();
    const stats = { profile: false, mixes: 0, follows: 0, opportunities: 0, buzzes: 0 };
    const errors: string[] = [];

    // 1. Create artist_profile node
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, created_at')
      .eq('id', user_id)
      .single();

    if (profile) {
      const { error: nodeErr } = await supabase.from('mythic_nodes').upsert(
        {
          node_type: 'artist_profile',
          owner_id: user_id,
          source_table: 'profiles',
          source_id: user_id,
          title: profile.username || 'Unknown Artist',
          payload: { avatar_url: profile.avatar_url },
          occurred_at: profile.created_at,
        },
        { onConflict: 'source_table,source_id', ignoreDuplicates: false }
      );

      if (!nodeErr) stats.profile = true;
      else errors.push(`profile node: ${nodeErr.message}`);
    }

    // 2. Create mix nodes for published mixes
    const { data: mixes } = await supabase
      .from('mixes')
      .select('id, title, genre_id, duration_seconds, tags, is_explicit, created_at')
      .eq('dj_id', user_id)
      .eq('published', true);

    if (mixes) {
      for (const mix of mixes) {
        const nodeId = await this.ensureMixNode(supabase, mix, user_id);
        if (nodeId) stats.mixes++;
        else errors.push(`mix ${mix.id}: failed to create node`);
      }
    }

    // 3. Create followed edges
    const { data: following } = await supabase
      .from('follows')
      .select('following_id, created_at')
      .eq('follower_id', user_id);

    if (following) {
      const myNodeId = await this.getArtistNodeId(supabase, user_id);
      if (myNodeId) {
        for (const f of following) {
          const targetNodeId = await this.getArtistNodeId(supabase, f.following_id);
          if (targetNodeId) {
            const { error: edgeErr } = await supabase.from('mythic_edges').upsert(
              {
                from_node_id: myNodeId,
                to_node_id: targetNodeId,
                edge_type: 'followed',
                weight: 1.0,
                occurred_at: f.created_at,
                source_event: 'backfill_user_graph',
              },
              { onConflict: 'from_node_id,to_node_id,edge_type' }
            );

            if (!edgeErr) stats.follows++;
            else errors.push(`follow ${f.following_id}: ${edgeErr.message}`);
          }
        }
      }
    }

    // 4. Create opportunity nodes + submitted_to edges
    const { data: saves } = await supabase
      .from('opportunity_saves')
      .select('opportunity_id, status, created_at')
      .eq('user_id', user_id);

    if (saves) {
      for (const save of saves) {
        const oppNodeId = await this.ensureOpportunityNode(supabase, save.opportunity_id);
        const myNodeId = await this.getArtistNodeId(supabase, user_id);

        if (oppNodeId && myNodeId) {
          const { error: edgeErr } = await supabase.from('mythic_edges').upsert(
            {
              from_node_id: myNodeId,
              to_node_id: oppNodeId,
              edge_type: 'submitted_to',
              weight: 3.0,
              occurred_at: save.created_at,
              source_event: 'backfill_user_graph',
              metadata: { status: save.status },
            },
            { onConflict: 'from_node_id,to_node_id,edge_type' }
          );

          if (!edgeErr) stats.opportunities++;
        }
      }
    }

    // 5. Create buzz nodes
    const { data: buzzes } = await supabase
      .from('buzzes')
      .select('id, text, created_at')
      .eq('author_id', user_id);

    if (buzzes) {
      for (const buzz of buzzes) {
        await supabase.from('mythic_nodes').upsert(
          {
            node_type: 'buzz',
            owner_id: user_id,
            source_table: 'buzzes',
            source_id: buzz.id,
            title: (buzz.text || '').slice(0, 100),
            payload: {},
            occurred_at: buzz.created_at,
          },
          { onConflict: 'source_table,source_id', ignoreDuplicates: false }
        );

        stats.buzzes++;
      }
    }

    // Enqueue follow-up work
    try {
      await enqueue_mythic_graph_job({ user_id }, 'derive_similarity_edges');
      await enqueue_mythic_graph_job({ user_id }, 'generate_node_embeddings', {
        node_ids: [user_id],
      });
    } catch (e) {
      errors.push(`enqueue follow-up: ${e instanceof Error ? e.message : String(e)}`);
    }

    return {
      status: errors.length > 0 ? 'partial' : 'complete',
      user_id,
      stats,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  private async ensureMixNode(
    supabase: ReturnType<typeof createServerClient>,
    mix: Record<string, unknown>,
    userId: string
  ): Promise<string | null> {
    const { data: existing } = await supabase
      .from('mythic_nodes')
      .select('id')
      .eq('source_table', 'mixes')
      .eq('source_id', mix.id)
      .maybeSingle();

    if (existing) return existing.id;

    const { data: node, error } = await supabase
      .from('mythic_nodes')
      .insert({
        node_type: 'mix',
        owner_id: userId,
        source_table: 'mixes',
        source_id: mix.id,
        title: mix.title || 'Untitled Mix',
        payload: {
          genre_id: mix.genre_id,
          tags: mix.tags,
          duration_seconds: mix.duration_seconds,
          is_explicit: mix.is_explicit,
        },
        occurred_at: mix.created_at,
      })
      .select('id')
      .single();

    if (error || !node) return null;

    // Create engaged_with edge from artist
    const artistNodeId = await this.getArtistNodeId(supabase, userId);
    if (artistNodeId) {
      await supabase.from('mythic_edges').upsert(
        {
          from_node_id: artistNodeId,
          to_node_id: node.id,
          edge_type: 'engaged_with',
          weight: 5.0,
          occurred_at: mix.created_at,
          source_event: 'backfill_user_graph',
        },
        { onConflict: 'from_node_id,to_node_id,edge_type' }
      );
    }

    return node.id;
  }

  private async ensureOpportunityNode(
    supabase: ReturnType<typeof createServerClient>,
    oppId: string
  ): Promise<string | null> {
    const { data: existing } = await supabase
      .from('mythic_nodes')
      .select('id')
      .eq('source_table', 'opportunities')
      .eq('source_id', oppId)
      .maybeSingle();

    if (existing) return existing.id;

    const { data: opp } = await supabase
      .from('opportunities')
      .select('title, genre_ids, city, created_at')
      .eq('id', oppId)
      .single();

    if (!opp) return null;

    const { data: node, error } = await supabase
      .from('mythic_nodes')
      .insert({
        node_type: 'opportunity',
        source_table: 'opportunities',
        source_id: oppId,
        title: opp.title || 'Untitled Opportunity',
        payload: {
          genres: opp.genre_ids,
          city: opp.city,
        },
        occurred_at: opp.created_at,
      })
      .select('id')
      .single();

    return error ? null : node?.id || null;
  }

  private async getArtistNodeId(
    supabase: ReturnType<typeof createServerClient>,
    profileId: string
  ): Promise<string | null> {
    const { data } = await supabase
      .from('mythic_nodes')
      .select('id')
      .eq('source_table', 'profiles')
      .eq('source_id', profileId)
      .maybeSingle();

    return data?.id || null;
  }
}

// Singleton instance (same pattern as audio worker)
export const mythicGraphProcessingWorker = new MythicGraphProcessingWorker();
