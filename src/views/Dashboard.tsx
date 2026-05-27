import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getMixesByDj, getProfileAnalytics, getUserActivity } from '../lib/api'
import { listAgents, type LuaAgent } from '../lib/agents'
import { useAuth } from '../hooks/useAuth'
import { HiveCard, HiveStat, WaveBar } from '../components/hive'
import { SkeletonFeed } from '../components/Skeleton'
import { ProfileCoachPanel } from '../components/ProfileCoachPanel'
import type { ActivityEvent, Mix, ProfileAnalytics } from '../lib/types'
import { colors, radius, space } from '../styles/tokens'

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.floor((now - then) / 1000)
  if (!Number.isFinite(diff)) return ''
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`
  return `${Math.floor(diff / 2592000)}mo ago`
}

function activityLabel(event: ActivityEvent) {
  if (event.activity_type === 'upload') return `Uploaded ${event.mix_title || 'a mix'}`
  if (event.activity_type === 'like') return `Liked ${event.mix_title || 'a mix'}`
  return `Followed ${event.target_display_name || event.target_username || 'a creator'}`
}

export function Dashboard() {
  const { user, profile } = useAuth()
  const [mixes, setMixes] = useState<Mix[]>([])
  const [analytics, setAnalytics] = useState<ProfileAnalytics | null>(null)
  const [activity, setActivity] = useState<ActivityEvent[]>([])
  const [agents, setAgents] = useState<LuaAgent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    setLoading(true)

    async function load() {
      const nextMixes = await getMixesByDj(user!.id)
      const [nextAnalytics, nextActivity, nextAgents] = await Promise.all([
        getProfileAnalytics(user!.id, nextMixes),
        getUserActivity(user!.id),
        listAgents().catch(() => [] as LuaAgent[]),
      ])
      if (cancelled) return
      setMixes(nextMixes)
      setAnalytics(nextAnalytics)
      setActivity(nextActivity)
      setAgents(nextAgents)
      setLoading(false)
    }

    void load().catch(() => {
      if (!cancelled) setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [user])

  const nextActions = useMemo(() => {
    const actions = [
      {
        title: 'Drop fresh nectar',
        body: mixes.length === 0 ? 'Publish your first mix and seed the hive.' : 'Keep your cell active with a new upload.',
        to: '/upload',
        cta: 'Upload mix',
      },
      {
        title: 'Tune your profile cell',
        body: profile?.bio ? 'Refresh your story, links, genres, and visuals.' : 'Add a bio, genres, links, and visuals so fans know your sound.',
        to: profile?.username ? `/u/${profile.username}` : '/settings',
        cta: 'Open profile',
      },
      {
        title: 'Build your EPK',
        body: 'Generate a booking-ready press kit from your profile and published mixes.',
        to: '/epk',
        cta: 'Open EPK studio',
      },
      {
        title: 'Find your next opening',
        body: 'Review Belgian pilot gigs, grants, radio calls, and club slots ranked for your profile.',
        to: '/opportunities',
        cta: 'Open opportunities',
      },
    ]
    return actions
  }, [mixes.length, profile?.bio, profile?.username])

  const topMix = analytics?.topMixes[0]
  const sparkline = analytics?.weeklyEvents.map(item => item.count) ?? [0, 0, 0, 0, 0, 0]

  if (loading) {
    return (
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '28px 16px 112px' }}>
        <SkeletonFeed />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: '28px 16px 112px' }}>
      <header
        className="hive-panel"
        style={{
          borderRadius: radius.lg,
          padding: 'clamp(22px, 4vw, 42px)',
          marginBottom: space[10],
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 720 }}>
          <p style={{ margin: '0 0 8px', color: 'var(--hive-gold)', fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
            Hive Growth OS
          </p>
          <h1 style={{ margin: 0, color: colors.text.primary, fontSize: 'clamp(30px, 6vw, 58px)', lineHeight: 1, textTransform: 'uppercase' }}>
            {profile?.display_name || profile?.username || 'Creator'} command cell
          </h1>
          <p style={{ margin: '16px 0 0', color: colors.text.secondary, fontSize: 16, lineHeight: 1.7 }}>
            Track your sound, activate the swarm, and turn listeners into collaborators.
          </p>
        </div>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: space[6], marginBottom: space[10] }}>
        <HiveCard><HiveStat label="plays" value={analytics?.totalPlays ?? 0} sparkline={sparkline} /></HiveCard>
        <HiveCard><HiveStat label="likes" value={analytics?.totalLikes ?? 0} /></HiveCard>
        <HiveCard><HiveStat label="comments" value={analytics?.totalComments ?? 0} /></HiveCard>
        <HiveCard><HiveStat label="followers" value={analytics?.followers ?? 0} /></HiveCard>
      </section>

      <section style={{ marginBottom: space[10] }}>
        <ProfileCoachPanel />
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(280px, 0.75fr)', gap: space[8], alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: space[8] }}>
          <HiveCard tone="glow">
            <h2 style={{ margin: '0 0 14px', color: colors.text.primary, fontSize: 20 }}>Top signal</h2>
            {topMix ? (
              <div style={{ display: 'grid', gridTemplateColumns: '86px minmax(0, 1fr)', gap: space[8], alignItems: 'center' }}>
                <div style={{ width: 86, aspectRatio: '1', borderRadius: radius.lg, background: topMix.artwork_url ? `url(${topMix.artwork_url}) center/cover` : `linear-gradient(135deg, ${colors.surfaceHover}, ${colors.accentFaint})` }} />
                <div style={{ minWidth: 0 }}>
                  <Link to={`/mix/${topMix.id}`} style={{ color: colors.text.primary, fontSize: 18, fontWeight: 800, textDecoration: 'none' }}>
                    {topMix.title}
                  </Link>
                  <p style={{ margin: '8px 0 0', color: colors.text.muted, fontSize: 13 }}>
                    {topMix.play_count} plays / {topMix.like_count} likes / {topMix.comment_count} comments
                  </p>
                  <div style={{ marginTop: 12 }}>
                    <WaveBar peaks={sparkline.length ? sparkline : [0, 0, 0, 0, 0, 0]} height={34} label="Weekly activity" />
                  </div>
                </div>
              </div>
            ) : (
              <p style={{ margin: 0, color: colors.text.muted }}>No top mix yet. Upload your first mix to start collecting signal.</p>
            )}
          </HiveCard>

          <HiveCard>
            <h2 style={{ margin: '0 0 14px', color: colors.text.primary, fontSize: 20 }}>Recent fan activity</h2>
            {activity.length === 0 ? (
              <p style={{ margin: 0, color: colors.text.muted }}>Activity will appear here as listeners play, like, follow, and comment.</p>
            ) : (
              <div style={{ display: 'grid', gap: space[4] }}>
                {activity.slice(0, 8).map((event, index) => (
                  <div key={`${event.created_at}-${index}`} style={{ display: 'flex', gap: space[4], alignItems: 'center', padding: space[5], border: `1px solid ${colors.border}`, borderRadius: radius.md, background: colors.surface }}>
                    <span aria-hidden="true" style={{ color: colors.accent }}>◆</span>
                    <span style={{ flex: 1, color: colors.text.secondary, fontSize: 13 }}>{activityLabel(event)}</span>
                    <span style={{ color: colors.text.dim, fontSize: 12 }}>{timeAgo(event.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </HiveCard>
        </div>

        <aside style={{ display: 'grid', gap: space[8] }}>
          <HiveCard>
            <h2 style={{ margin: '0 0 14px', color: colors.text.primary, fontSize: 20 }}>Next best actions</h2>
            <div style={{ display: 'grid', gap: space[5] }}>
              {nextActions.map(action => (
                <Link key={action.title} to={action.to} style={{ display: 'block', padding: space[6], border: `1px solid ${colors.border}`, borderRadius: radius.md, background: colors.surface, color: 'inherit', textDecoration: 'none' }}>
                  <strong style={{ display: 'block', color: colors.text.primary, fontSize: 14 }}>{action.title}</strong>
                  <span style={{ display: 'block', marginTop: 5, color: colors.text.muted, fontSize: 12, lineHeight: 1.5 }}>{action.body}</span>
                  <span style={{ display: 'inline-block', marginTop: 10, color: colors.accent, fontSize: 12, fontWeight: 800, textTransform: 'uppercase' }}>{action.cta}</span>
                </Link>
              ))}
            </div>
          </HiveCard>

          <HiveCard>
            <h2 style={{ margin: '0 0 14px', color: colors.text.primary, fontSize: 20 }}>Automation bees</h2>
            <p style={{ margin: '0 0 14px', color: colors.text.muted, fontSize: 13, lineHeight: 1.6 }}>
              {agents.length === 0
                ? 'Fork a starter agent to welcome followers, watch comments, and surface fan signals.'
                : `${agents.filter(agent => agent.enabled).length} active / ${agents.length} total agents watching your hive.`}
            </p>
            <Link to={agents.length === 0 ? '/agents/gallery' : '/agents'} style={{ color: colors.accent, fontWeight: 800, fontSize: 13, textTransform: 'uppercase', textDecoration: 'none' }}>
              {agents.length === 0 ? 'Fork starter agent' : 'Manage agents'}
            </Link>
          </HiveCard>
        </aside>
      </section>
    </div>
  )
}
