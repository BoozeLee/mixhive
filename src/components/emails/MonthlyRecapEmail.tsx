interface Props {
  displayName: string;
  plays: number;
  likes: number;
  comments: number;
  newMixes: number;
  followersGained: number;
}

export function MonthlyRecapEmail({
  displayName,
  plays,
  likes,
  comments,
  newMixes,
  followersGained,
}: Props) {
  return (
    <div style={{ fontFamily: 'sans-serif', color: '#111', maxWidth: 480 }}>
      <h1>Your MixHive month in review</h1>
      <p>Hi {displayName}, here is how your sound moved the hive this month:</p>
      <ul>
        <li>{plays.toLocaleString()} plays</li>
        <li>{likes.toLocaleString()} likes</li>
        <li>{comments.toLocaleString()} comments</li>
        <li>
          {newMixes} new mix{newMixes === 1 ? '' : 'es'}
        </li>
        <li>
          {followersGained} new follower{followersGained === 1 ? '' : 's'}
        </li>
      </ul>
      <p>
        <a href="https://mixhive.app/dashboard">Open your dashboard →</a>
      </p>
    </div>
  );
}
