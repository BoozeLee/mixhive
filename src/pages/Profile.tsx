import { useEffect, useState } from 'react'

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.floor((now - then) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`
  return `${Math.floor(diff / 2592000)}mo ago`
}
import { useParams, Link } from 'react-router-dom'
import { getProfile, getMixesByDj, isFollowing, follow, unfollow, getFollowersCount, getFollowingCount, getPlaylistsByUser, getUserActivity } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import { MixCard } from '../components/MixCard'
import { PlaylistCard } from '../components/PlaylistCard'
import { BlockButton } from '../components/BlockButton'
import { SkeletonProfile } from '../components/Skeleton'
import { NotFoundState } from '../components/EmptyState'
import type { Profile as ProfileType, Mix, Playlist, ActivityEvent } from '../lib/types'

export function ProfilePage() {
  const { username } = useParams<{ username: string }>()
  const { user } = useAuth()
  const [profile, setProfile] = useState<ProfileType | null>(null)
  const [mixes, setMixes] = useState<Mix[]>([])
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [activity, setActivity] = useState<ActivityEvent[]>([])
  const [following, setFollowing] = useState(false)
  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const isOwn = user && profile?.id === user.id

  useEffect(() => {
    if (!username) return
    setLoading(true)
    getProfile(username).then(async p => {
      setProfile(p)
      if (p) {
        const [m, fc, fgc, pl, acts] = await Promise.all([
          getMixesByDj(p.id),
          getFollowersCount(p.id),
          getFollowingCount(p.id),
          getPlaylistsByUser(p.id),
          getUserActivity(p.id),
        ])
        setMixes(m)
        setPlaylists(pl)
        setActivity(acts)
        setFollowersCount(fc)
        setFollowingCount(fgc)
        if (user && user.id !== p.id) {
          setFollowing(await isFollowing(user.id, p.id))
        }
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [username, user])

  async function toggleFollow() {
    if (!user || !profile) return
    if (following) {
      await unfollow(user.id, profile.id)
      setFollowersCount(prev => prev - 1)
    } else {
      await follow(user.id, profile.id)
      setFollowersCount(prev => prev + 1)
    }
    setFollowing(!following)
  }

  if (loading) return <SkeletonProfile />
  if (!profile) return <NotFoundState what="DJ" />

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', gap: 20, marginBottom: 24 }}>
        <div style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: profile.avatar_url
            ? `url(${profile.avatar_url}) center/cover`
            : 'linear-gradient(135deg, #1a1a2e, #f0c04022)',
          border: '2px solid #1a1a2e',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 28,
          color: '#f0c04044'
        }}>
          {!profile.avatar_url && '🎧'}
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#eee', margin: 0 }}>
            {profile.display_name || profile.username}
            {profile.verified && <span style={{ color: '#f0c040', fontSize: 16, marginLeft: 6 }}>✓</span>}
          </h1>
          <p style={{ color: '#666', fontSize: 13, margin: '4px 0' }}>@{profile.username}</p>
          {profile.bio && <p style={{ color: '#999', fontSize: 14, margin: '8px 0' }}>{profile.bio}</p>}
          {profile.location && <p style={{ color: '#555', fontSize: 12, margin: '4px 0' }}>{profile.location}</p>}
          <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 13, color: '#888' }}>
            <span><strong style={{ color: '#ccc' }}>{followersCount}</strong> followers</span>
            <span><strong style={{ color: '#ccc' }}>{followingCount}</strong> following</span>
            <span><strong style={{ color: '#ccc' }}>{mixes.length}</strong> mixes</span>
          </div>
        </div>
      </div>

      {user && !isOwn && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          <button onClick={toggleFollow} style={{
            padding: '8px 24px',
            borderRadius: 8,
            border: following ? '1px solid #333' : 'none',
            background: following ? 'transparent' : '#f0c040',
            color: following ? '#888' : '#0a0a0a',
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
          }}>
            {following ? 'Following' : 'Follow'}
          </button>
          <BlockButton targetUserId={profile.id} currentUserId={user.id} />
        </div>
      )}

      {isOwn && (
        <Link to="/settings" style={{
          display: 'inline-block',
          padding: '8px 24px',
          borderRadius: 8,
          border: '1px solid #333',
          background: 'transparent',
          color: '#888',
          fontWeight: 600,
          fontSize: 14,
          textDecoration: 'none',
          marginBottom: 24
        }}>
          Edit profile
        </Link>
      )}

      {profile.genres && profile.genres.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 24 }}>
          {profile.genres.map(g => (
            <span key={g} style={{ background: '#1a1a2e', color: '#888', padding: '4px 10px', borderRadius: 12, fontSize: 12 }}>
              {g}
            </span>
          ))}
        </div>
      )}

      {activity.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#ccc', marginBottom: 10 }}>Recent Activity</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#888' }}>
            {activity.slice(0, 10).map((ev, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ color: '#555' }}>
                  {ev.activity_type === 'upload' && '🎵'}
                  {ev.activity_type === 'like' && '♥'}
                  {ev.activity_type === 'follow' && '⊞'}
                </span>
                <span>
                  {ev.activity_type === 'upload' && (
                    <>Uploaded <Link to={`/mix/${ev.mix_id}`} style={{ color: '#bbb', textDecoration: 'none' }}>{ev.mix_title}</Link></>
                  )}
                  {ev.activity_type === 'like' && (
                    <>Liked <Link to={`/mix/${ev.mix_id}`} style={{ color: '#bbb', textDecoration: 'none' }}>{ev.mix_title}</Link></>
                  )}
                  {ev.activity_type === 'follow' && (
                    <>Followed <Link to={`/u/${ev.target_username}`} style={{ color: '#bbb', textDecoration: 'none' }}>{ev.target_display_name || ev.target_username}</Link></>
                  )}
                </span>
                <span style={{ color: '#555', fontSize: 11, marginLeft: 'auto' }}>
                  {timeAgo(ev.created_at)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <h2 style={{ fontSize: 16, fontWeight: 600, color: '#ccc', marginBottom: 12 }}>Mixes</h2>
      {mixes.length === 0 ? (
        <p style={{ color: '#555', fontSize: 14 }}>No mixes yet</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {mixes.map(mix => (
            <MixCard key={mix.id} mix={{
              ...mix,
              dj_username: profile.username,
              dj_display_name: profile.display_name || profile.username,
              dj_avatar_url: profile.avatar_url || '',
              genre_name: null,
              weekly_plays: 0
            }} />
          ))}
        </div>
      )}

      <h2 style={{ fontSize: 16, fontWeight: 600, color: '#ccc', marginBottom: 12, marginTop: 32 }}>Playlists</h2>
      {playlists.length === 0 ? (
        <p style={{ color: '#555', fontSize: 14 }}>No playlists yet</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {playlists.map(p => (
            <PlaylistCard key={p.id} playlist={p} />
          ))}
        </div>
      )}
    </div>
  )
}
