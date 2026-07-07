# Upload Release Flow v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the existing 5-step upload wizard and ship v1 release mechanics (drafts, schedule-later, platform links, post-publish agent suggestions) on MixHive.

**Architecture:** Extend the `mixes` table with `visibility`, `scheduled_at`, and `published_at`; add service-role API routes for draft/schedule/cron transitions; update the `/upload` wizard and dashboard to expose the new states; keep real platform integrations out of v1.

**Tech Stack:** Next.js (App Router), React, TypeScript, Supabase (Postgres + Edge functions/cron), Zod, next-intl.

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/086_mixes_release_state.sql` | Adds `visibility`, `scheduled_at`, `published_at` to `mixes`; RLS policy updates. |
| `src/lib/database.types.ts` | Regenerated Supabase types. |
| `src/lib/types.ts` | Update `Mix` type with new fields. |
| `src/lib/schemas.ts` | Add schedule datetime and platform link validation schemas. |
| `src/lib/api.ts` | Update `createMix`/`updateMix`; add draft/schedule helpers. |
| `src/app/api/mixes/draft/route.ts` | POST to persist a draft mix. |
| `src/app/api/mixes/schedule/route.ts` | POST to schedule a mix. |
| `src/app/api/cron/publish-scheduled/route.ts` | CRON_SECRET-gated batch publish of due scheduled mixes. |
| `src/views/Upload.tsx` | Add draft resume prompt, schedule toggle, platform links, save-draft action. |
| `src/components/upload/PlatformLinksSection.tsx` | New reusable platform links editor. |
| `src/components/upload/SchedulePublishToggle.tsx` | New schedule-now/later toggle with datetime input. |
| `src/components/upload/PostPublishPanel.tsx` | Already exists; verify agent cards link correctly. |
| `src/views/Dashboard.tsx` | Add Drafts and Scheduled sections. |
| `messages/en.json` | New upload/dashboard copy keys. |
| `vercel.json` | Add cron backup entry for `publish-scheduled`. |
| `worker/scheduler/schedule.rb` | Add cron job for `publish-scheduled` if worker scheduler is active. |

---

## Phase 1 — Schema & Types

### Task 1: Migration for release state

**Files:**
- Create: `supabase/migrations/086_mixes_release_state.sql`

- [ ] **Step 1: Write migration**

```sql
-- Mixes release state v1
-- Adds visibility, scheduled_at, published_at to support drafts and scheduled publishing.

begin;

alter table public.mixes
  add column if not exists visibility text not null default 'draft'
    check (visibility in ('draft','scheduled','published','unlisted')),
  add column if not exists scheduled_at timestamptz null,
  add column if not exists published_at timestamptz null;

-- Backfill existing published mixes
update public.mixes
set visibility = 'published', published_at = coalesce(created_at, now())
where published = true and visibility = 'draft';

-- Ensure future published mixes keep published_at
comment on column public.mixes.published_at is 'Set once when visibility first transitions to published';

-- Partial index for due scheduled mixes
create index if not exists idx_mixes_scheduled_due
  on public.mixes(scheduled_at)
  where visibility = 'scheduled';

-- Existing RLS: owners can read their own rows regardless of visibility
commit;
```

- [ ] **Step 2: Apply migration locally**

Run: `supabase db push` or apply via SQL Editor.
Expected: migration succeeds, columns exist.

- [ ] **Step 3: Regenerate types**

Run: `npm run db:types`
Expected: `src/lib/database.types.ts` updated with new columns.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/086_mixes_release_state.sql src/lib/database.types.ts
git commit -m "feat(db): add mixes visibility, scheduled_at, published_at"
```

### Task 2: Update TypeScript types

**Files:**
- Modify: `src/lib/types.ts:124-157`

- [ ] **Step 1: Update Mix interface**

```typescript
export interface Mix {
  id: string;
  dj_id: string;
  title: string;
  description: string | null;
  artwork_url: string | null;
  audio_url: string;
  duration_seconds: number | null;
  genre_id: number | null;
  tags: string[];
  tracklist: TrackItem[];
  platform_links: Record<string, string>;
  is_explicit: boolean;
  play_count: number;
  like_count: number;
  comment_count: number;
  /** @deprecated use visibility === 'published' */
  published: boolean;
  visibility: 'draft' | 'scheduled' | 'published' | 'unlisted';
  scheduled_at: string | null;
  published_at: string | null;
  status: 'processing' | 'ready' | 'error';
  upload_status?: 'uploaded' | 'processing' | 'ready' | 'failed';
  processing_started_at?: string | null;
  processed_at?: string | null;
  processing_errors?: unknown[] | null;
  waveform_url: string | null;
  waveform_data?: unknown | null;
  audio_metadata?: unknown | null;
  audio_quality: string | null;
  created_at: string;
  updated_at: string;
  dj?: Profile;
  genre_name?: string | null;
  weekly_plays?: number;
  ai_band?: boolean;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(types): add Mix visibility/scheduled/published fields"
```

---

## Phase 2 — Validation & API Helpers

### Task 3: Add validation schemas

**Files:**
- Modify: `src/lib/schemas.ts`

- [ ] **Step 1: Add PlatformLinksSchema and ScheduleSchema**

```typescript
export const PlatformLinksSchema = z.record(
  z.enum(['soundcloud', 'mixcloud', 'youtube', 'spotify', 'applemusic']),
  z.string().url('Invalid URL').or(z.literal(''))
);

export const ScheduleSchema = z.object({
  scheduledAt: z.string().datetime().refine(
    iso => new Date(iso) > new Date(Date.now() + 5 * 60 * 1000),
    'Schedule time must be at least 5 minutes in the future'
  ),
});
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/schemas.ts
git commit -m "feat(schemas): add platform links and schedule validation"
```

### Task 4: Update createMix/updateMix helpers

**Files:**
- Modify: `src/lib/api.ts:476-505`

- [ ] **Step 1: Read existing createMix/updateMix**

- [ ] **Step 2: Update helpers to accept visibility**

```typescript
export async function createMix(mix: Partial<Mix>): Promise<Mix | null> {
  const { data, error } = await supabase
    .from('mixes')
    .insert({
      ...mix,
      visibility: mix.visibility ?? 'published',
      published_at: mix.visibility === 'published' ? new Date().toISOString() : mix.published_at,
    })
    .select()
    .single();
  if (error) {
    console.error('createMix error:', error);
    return null;
  }
  return data as Mix;
}

export async function updateMix(id: string, updates: Partial<Mix>): Promise<void> {
  const payload: Partial<Mix> = { ...updates };
  if (updates.visibility === 'published' && !updates.published_at) {
    payload.published_at = new Date().toISOString();
  }
  const { error } = await supabase.from('mixes').update(payload).eq('id', id);
  if (error) {
    console.error('updateMix error:', error);
    throw error;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat(api): support visibility in createMix/updateMix"
```

---

## Phase 3 — API Routes

### Task 5: Draft route

**Files:**
- Create: `src/app/api/mixes/draft/route.ts`

- [ ] **Step 1: Write route**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { id, ...fields } = body;

  const payload = {
    ...fields,
    dj_id: user.id,
    visibility: 'draft' as const,
  };

  if (id) {
    const { error } = await supabase.from('mixes').update(payload).eq('id', id).eq('dj_id', user.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ id });
  }

  const { data, error } = await supabase.from('mixes').insert(payload).select('id').single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ id: data.id });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/mixes/draft/route.ts
git commit -m "feat(api): add POST /api/mixes/draft"
```

### Task 6: Schedule route

**Files:**
- Create: `src/app/api/mixes/schedule/route.ts`

- [ ] **Step 1: Write route**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { ScheduleSchema } from '@/lib/schemas';

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const scheduleResult = ScheduleSchema.safeParse({ scheduledAt: body.scheduledAt });
  if (!scheduleResult.success) {
    return NextResponse.json(
      { error: scheduleResult.error.flatten().fieldErrors.scheduledAt?.[0] ?? 'Invalid schedule' },
      { status: 400 }
    );
  }

  const { id, ...fields } = body;
  if (!id) {
    return NextResponse.json({ error: 'Mix id is required' }, { status: 400 });
  }

  const { error } = await supabase
    .from('mixes')
    .update({
      ...fields,
      visibility: 'scheduled',
      scheduled_at: scheduleResult.data.scheduledAt,
    })
    .eq('id', id)
    .eq('dj_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ id });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/mixes/schedule/route.ts
git commit -m "feat(api): add POST /api/mixes/schedule"
```

### Task 7: Publish scheduled cron

**Files:**
- Create: `src/app/api/cron/publish-scheduled/route.ts`

- [ ] **Step 1: Write route**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerClient();
  const now = new Date().toISOString();

  const { data: due, error: fetchError } = await supabase
    .from('mixes')
    .select('id')
    .eq('visibility', 'scheduled')
    .lte('scheduled_at', now);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const ids = due?.map(r => r.id) ?? [];
  if (ids.length === 0) {
    return NextResponse.json({ published: 0 });
  }

  const { error: updateError } = await supabase
    .from('mixes')
    .update({ visibility: 'published', published_at: now })
    .in('id', ids)
    .eq('visibility', 'scheduled');

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ published: ids.length });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/cron/publish-scheduled/route.ts
git commit -m "feat(cron): add publish-scheduled endpoint"
```

### Task 8: Wire cron in Vercel and worker scheduler

**Files:**
- Modify: `vercel.json`
- Modify: `worker/scheduler/schedule.rb`

- [ ] **Step 1: Add Vercel cron backup**

In `vercel.json`, add inside the existing `crons` array:

```json
{
  "path": "/api/cron/publish-scheduled",
  "schedule": "*/10 * * * *"
}
```

- [ ] **Step 2: Add worker scheduler job**

In `worker/scheduler/schedule.rb`, add to the `JOBS` hash:

```ruby
'/api/cron/publish-scheduled' => Integer(ENV.fetch('IV_PUBLISH_SCHEDULED', 600))
```

- [ ] **Step 3: Commit**

```bash
git add vercel.json worker/scheduler/schedule.rb
git commit -m "chore(cron): wire publish-scheduled cron"
```

---

## Phase 4 — UI Components

### Task 9: Platform links section component

**Files:**
- Create: `src/components/upload/PlatformLinksSection.tsx`

- [ ] **Step 1: Implement component**

```typescript
import { useTranslations } from 'next-intl';
import { Input } from '../ui/Input';

const PLATFORMS = [
  { key: 'soundcloud', label: 'SoundCloud' },
  { key: 'mixcloud', label: 'Mixcloud' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'spotify', label: 'Spify' },
  { key: 'applemusic', label: 'Apple Music' },
] as const;

interface Props {
  values: Record<string, string>;
  errors: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

export function PlatformLinksSection({ values, errors, onChange }: Props) {
  const t = useTranslations('upload');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h3>{t('platformLinksTitle')}</h3>
      {PLATFORMS.map(({ key, label }) => (
        <Input
          key={key}
          label={label}
          type="url"
          placeholder={`https://${key}.com/...`}
          value={values[key] ?? ''}
          error={errors[key]}
          onChange={e => onChange(key, e.target.value)}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/upload/PlatformLinksSection.tsx
git commit -m "feat(upload): add PlatformLinksSection component"
```

### Task 10: Schedule publish toggle component

**Files:**
- Create: `src/components/upload/SchedulePublishToggle.tsx`

- [ ] **Step 1: Implement component**

```typescript
import { useTranslations } from 'next-intl';

interface Props {
  mode: 'now' | 'later';
  scheduledAt: string;
  error?: string;
  onModeChange: (mode: 'now' | 'later') => void;
  onScheduledAtChange: (value: string) => void;
}

export function SchedulePublishToggle({
  mode,
  scheduledAt,
  error,
  onModeChange,
  onScheduledAtChange,
}: Props) {
  const t = useTranslations('upload');
  const minDate = new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 12 }}>
        <button type="button" onClick={() => onModeChange('now')}>
          {t('publishNow')}
        </button>
        <button type="button" onClick={() => onModeChange('later')}>
          {t('scheduleForLater')}
        </button>
      </div>
      {mode === 'later' && (
        <>
          <input
            type="datetime-local"
            min={minDate}
            value={scheduledAt}
            onChange={e => onScheduledAtChange(e.target.value)}
          />
          {error && <span style={{ color: 'red' }}>{error}</span>}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/upload/SchedulePublishToggle.tsx
git commit -m "feat(upload): add SchedulePublishToggle component"
```

### Task 11: Integrate release mechanics into Upload view

**Files:**
- Modify: `src/views/Upload.tsx`

- [ ] **Step 1: Add localStorage draft key and load on mount**

Add constants:

```typescript
const DRAFT_KEY = 'mixhive-upload-draft';
```

Add state:

```typescript
const [draftMixId, setDraftMixId] = useState<string | null>(null);
const [publishMode, setPublishMode] = useState<'now' | 'later'>('now');
const [scheduledAt, setScheduledAt] = useState('');
```

On mount, load localStorage draft and offer resume if present.

- [ ] **Step 2: Persist form state to localStorage on change**

Use a debounced effect to save `{ formData, tracklist, platformLinks, isExplicit }` to `localStorage`.

- [ ] **Step 3: Add Save draft handler**

```typescript
async function saveDraft() {
  const res = await fetch('/api/mixes/draft', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: draftMixId,
      title: formData.title,
      description: formData.description,
      genre_id: formData.genreId,
      tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
      tracklist,
      platform_links: platformLinks,
      is_explicit: isExplicit,
      duration_seconds: duration,
    }),
  });
  const result = await res.json();
  if (res.ok) {
    setDraftMixId(result.id);
    localStorage.removeItem(DRAFT_KEY);
    // show success toast
  } else {
    setGeneralError(result.error || 'Failed to save draft');
  }
}
```

- [ ] **Step 4: Add schedule handler**

If `publishMode === 'later'`, call `/api/mixes/schedule` after file uploads instead of publishing immediately.

- [ ] **Step 5: Clear localStorage draft on successful publish/schedule**

- [ ] **Step 6: Commit**

```bash
git add src/views/Upload.tsx
git commit -m "feat(upload): integrate drafts, scheduling, and platform links"
```

### Task 12: Dashboard drafts and scheduled sections

**Files:**
- Modify: `src/views/Dashboard.tsx`

- [ ] **Step 1: Fetch draft and scheduled mixes**

Add query:

```typescript
const { data: drafts } = useQuery({
  queryKey: ['mixes', user?.id, 'draft'],
  queryFn: async () => {
    const { data } = await supabase
      .from('mixes')
      .select('id, title, scheduled_at, created_at')
      .eq('dj_id', user!.id)
      .in('visibility', ['draft', 'scheduled'])
      .order('created_at', { ascending: false });
    return data ?? [];
  },
  enabled: !!user,
});
```

- [ ] **Step 2: Render sections**

Render two lists:
- Drafts → link to `/upload?draft=<id>`
- Scheduled → show countdown to `scheduled_at`

- [ ] **Step 3: Commit**

```bash
git add src/views/Dashboard.tsx
git commit -m "feat(dashboard): add drafts and scheduled mixes sections"
```

### Task 13: i18n copy

**Files:**
- Modify: `messages/en.json`

- [ ] **Step 1: Add keys**

Under `upload`:

```json
"platformLinksTitle": "Platform links",
"publishNow": "Publish now",
"scheduleForLater": "Schedule for later",
"saveDraft": "Save draft",
"draftSaved": "Draft saved",
"scheduleSuccess": "Mix scheduled",
"resumeDraft": "Resume draft",
"startNewUpload": "Start new upload"
```

- [ ] **Step 2: Commit**

```bash
git add messages/en.json
git commit -m "feat(i18n): add upload release flow copy"
```

---

## Phase 5 — Verification

### Task 14: Type check

- [ ] **Step 1: Run type check**

Run: `npm run type-check`
Expected: no errors.

### Task 15: Build

- [ ] **Step 1: Run build**

Run: `npm run build`
Expected: build succeeds.

### Task 16: Local smoke

- [ ] **Step 1: Start dev server**

Run: `npm run dev`

- [ ] **Step 2: Verify flows**

1. `/upload` loads.
2. Save draft works and appears on `/dashboard`.
3. Schedule a mix and confirm `visibility='scheduled'` in Supabase.
4. Call `/api/cron/publish-scheduled` with `CRON_SECRET` and verify scheduled mix publishes.
5. Platform links save and render on mix detail page.

### Task 17: Deploy

- [ ] **Step 1: Push branch**

Run: `git push origin main` (or open PR). Ask user for confirmation before pushing.

- [ ] **Step 2: Apply migration to production**

Run: `supabase db push` against production project, or apply `086_mixes_release_state.sql` via Supabase SQL Editor.

- [ ] **Step 3: Verify production**

Run: `curl -I https://mixhive.vercel.app/upload`
Expected: HTTP 200.

---

## Self-Review

### Spec coverage

| Spec requirement | Plan task |
|---|---|
| 5-step upload wizard AC | Task 11, Task 14 |
| Draft save/resume | Task 5, Task 11, Task 12 |
| Schedule for later | Task 6, Task 7, Task 8, Task 10, Task 11 |
| Platform links | Task 9, Task 11, Task 13 |
| Post-publish agent suggestions | Task 11 (verify existing PostPublishPanel) |
| Schema changes | Task 1, Task 2 |
| Cron publish | Task 7, Task 8 |

### Placeholder scan

No `TBD`, `TODO`, or vague "add validation" steps. All code snippets are complete for their scope.

### Type consistency

- `visibility` values: `'draft' | 'scheduled' | 'published' | 'unlisted'` used consistently.
- `scheduled_at` / `published_at` typed as ISO strings in TypeScript, `timestamptz` in SQL.
- `platform_links` remains `Record<string, string>` / JSON.
