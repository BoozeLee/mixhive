import type { IconKey } from '../lib/icons';

export interface HelpArticle {
  slug: string;
  title: string;
  summary: string;
  category: HelpCategoryId;
  /** Markdown body rendered with react-markdown + remark-gfm. */
  body: string;
}

export type HelpCategoryId = 'start' | 'create' | 'agents' | 'community' | 'market' | 'account';

export interface HelpCategory {
  id: HelpCategoryId;
  label: string;
  icon: IconKey;
  blurb: string;
}

export const HELP_CATEGORIES: HelpCategory[] = [
  { id: 'start', label: 'Getting Started', icon: 'home', blurb: 'New to the hive? Start here.' },
  { id: 'create', label: 'Creating', icon: 'upload', blurb: 'Upload mixes, build releases.' },
  {
    id: 'agents',
    label: 'AI Agents',
    icon: 'agents',
    blurb: 'Automate your profile with Lua agents.',
  },
  { id: 'community', label: 'Community', icon: 'quests', blurb: 'Collab quests and the scene.' },
  { id: 'market', label: 'Marketplace', icon: 'gear', blurb: 'Gear, agents, and getting paid.' },
  {
    id: 'account',
    label: 'Account & Security',
    icon: 'settings',
    blurb: 'Sign-in, privacy, notifications.',
  },
];

export const HELP_ARTICLES: HelpArticle[] = [
  {
    slug: 'getting-started',
    title: 'Getting started on MixHive',
    summary: 'Create your account, set up your cell, and find your first mixes.',
    category: 'start',
    body: `
MixHive is the social home for the underground creative economy — for DJs, producers, visual artists, and the people who build the scene.

## 1. Create your account
Head to **Join the Hive** and sign up with email or Google. After confirming, you'll land on onboarding to set your **profile cell** — username, display name, genres, and disciplines.

## 2. Set up your cell
Your profile is your home base. Add an avatar, a banner, your genres, and link your socials (SoundCloud, Bandcamp, Instagram). A complete cell gets discovered faster.

## 3. Find your scene
- **Explore** surfaces trending mixes by genre.
- **Search** finds DJs, mixes, and collaborators.
- **Scene Radar** uses AI to map the artists and nights near your sound.

## 4. Start participating
Follow creators, repost mixes you love, drop a **Buzz** (short post), and join a **Collab Quest**. The more you engage, the more the hive surfaces for you.
`,
  },
  {
    slug: 'uploading-your-first-mix',
    title: 'Uploading your first mix',
    summary: 'Supported formats, artwork, waveforms, and publishing.',
    category: 'create',
    body: `
## Supported files
MixHive accepts **MP3, WAV, FLAC, OGG, AAC, and M4A**. For best quality, upload a WAV or a 320 kbps MP3.

## Steps
1. Go to **Upload** (the + in the nav).
2. Drop your audio file. A waveform is generated automatically after upload.
3. Add a **title**, **genre**, and **cover artwork** (square images look best).
4. Publish.

## Waveforms & analysis
After upload, a background worker decodes your file and attaches a **waveform** and **duration** to the mix. This can take up to a minute for long sets — refresh the mix page if it isn't there yet.

## Tips
- Tag the right **genre** so Scene Radar and Explore can place your mix.
- A strong **cover** dramatically improves play-through.
- Link the mix in a **Buzz** to push it to your followers' feeds.
`,
  },
  {
    slug: 'building-ai-agents',
    title: 'Building & running AI agents',
    summary: 'Write Lua agents that work your profile while you sleep.',
    category: 'agents',
    body: `
MixHive lets you write **Lua agents** — small automations that react to events on your profile (a new follower, a comment, a mention) and act for you.

## Triggers
Agents run on events: \`on_follow\`, \`on_comment\`, \`on_reply\`, \`on_mention\`, \`on_like\`, \`on_repost\`, \`on_mix_upload\`, \`on_schedule\` (cron), and \`manual\`.

## The \`mh\` toolkit
Inside an agent you get a sandboxed \`mh\` library:

\`\`\`lua
function on_follow(event)
  local who = mh.get_profile(event.actor_id)
  mh.notify("New follower: " .. who.username)
  mh.follow(event.actor_id)  -- follow back
end
\`\`\`

Reads: \`mh.get_mix()\`, \`mh.get_profile()\`, \`mh.fetch_recent_mixes()\`.
Writes: \`mh.comment()\`, \`mh.post_buzz()\`, \`mh.like()\`, \`mh.repost()\`, \`mh.notify()\`, \`mh.kv_set()\`.

## Build, test, install
- **Agent Builder** (\`/agents\`) — write and test your own.
- **Agent Gallery** — fork community starter agents.
- **Agent Marketplace** — install free or paid agents.

> Agents run in a hardened sandbox with strict time and write limits, so a runaway script can never spam or break your account.
`,
  },
  {
    slug: 'collab-quests',
    title: 'Collab Quests',
    summary: 'Assemble a crew across disciplines and ship a project together.',
    category: 'community',
    body: `
**Collab Quests** are RPG-style team projects. Post a quest, define the roles you need (producer, vocalist, visual artist), and recruit a crew.

## Joining a quest
Browse \`/collab-quests\`, open one that fits your skills, and apply for a role. The quest owner reviews applications and assembles the team.

## Running a quest
1. **Post** a quest with a title, brief, and the roles required.
2. **Recruit** — review applicants and fill each role.
3. **Phases** — move the quest through its milestones as the crew ships.
4. **Complete** — finished quests award XP and reputation to everyone involved.

Quests are how the scene builds things together — and how you meet collaborators you'd never find on a feed alone.
`,
  },
  {
    slug: 'marketplace',
    title: 'Gear & Agent Marketplace',
    summary: 'Buy and sell gear with escrow, and install agents.',
    category: 'market',
    body: `
## Gear marketplace
List used DJ and studio gear, or buy from the community. Payments run through **Stripe escrow**: the buyer's money is held until the item is confirmed received, protecting both sides. A small platform fee (2.5–5%) applies to each sale.

## Agent marketplace
Install **Lua agents** built by the community. Free agents install instantly. Paid agents use a one-time **Stripe checkout** — the creator keeps the majority (70%), the platform takes 30% to run the infrastructure.

## Getting paid
To sell gear or paid agents you'll connect a Stripe account for payouts. Earnings settle to your connected account automatically.
`,
  },
  {
    slug: 'your-profile-and-epk',
    title: 'Your profile & Press Kit (EPK)',
    summary: 'Build a shareable electronic press kit from your MixHive profile.',
    category: 'create',
    body: `
Your **Press Kit Studio** (\`/epk\`) turns your MixHive profile into a shareable **EPK** — the one link you send to promoters and bookers.

## What's in an EPK
- Bio and genres
- Your best mixes
- Stats (plays, followers)
- Social and booking links

## Sharing
Each EPK gets a public URL (\`/epk/your-slug\`) you can drop anywhere. Update your profile and the EPK stays in sync.
`,
  },
  {
    slug: 'account-sign-in-security',
    title: 'Account, sign-in & security',
    summary: 'Email and Google sign-in, password resets, and account safety.',
    category: 'account',
    body: `
## Signing in
You can sign in with **email + password** or **Google**. Both create the same account — if you signed up with email, use email; if you used Google, use the Google button.

## Forgot your password?
On the sign-in page, tap **Forgot password?**, enter your email, and follow the reset link we send. Reset links expire — if yours says "link expired," just request a new one.

## Password rules
Passwords must be at least **6 characters**. Use something unique you don't reuse elsewhere.

## Already signed in
If you're signed in and open the login page, MixHive sends you straight to your feed — no need to sign in twice.

## Security
We never see your password (auth is handled by Supabase). Your sessions refresh automatically and you can sign out from the avatar menu at any time.
`,
  },
  {
    slug: 'push-notifications',
    title: 'Push notifications',
    summary: 'Get browser notifications for follows, likes, and comments.',
    category: 'account',
    body: `
MixHive can send **browser push notifications** so you hear about new followers, likes, comments, and mentions even when the tab is closed.

## Turn it on
Click the **bell** in the top bar — if push is available you'll see an **Enable push** nudge. Accept the browser permission prompt and you're subscribed.

## Turn it off
Revoke notification permission in your browser's site settings for MixHive, or clear the subscription from the bell. We stop sending immediately.

## What you'll get
A short summary per event (e.g. "🐝 New follower"). Tapping a notification opens the relevant page in MixHive.
`,
  },
];

export function getArticle(slug: string): HelpArticle | undefined {
  return HELP_ARTICLES.find(a => a.slug === slug);
}

export function articlesByCategory(id: HelpCategoryId): HelpArticle[] {
  return HELP_ARTICLES.filter(a => a.category === id);
}
