import { Link } from 'react-router-dom';
import { parseMentions } from '../lib/types';
import type { MentionPart } from '../lib/types';

interface Props {
  body: string;
}

export function MentionRenderer({ body }: Props) {
  const parts: MentionPart[] = parseMentions(body);

  return (
    <span>
      {parts.map((part, i) =>
        part.type === 'mention' ? (
          <Link
            key={i}
            to={`/u/${part.value}`}
            style={{ color: '#f0c040', textDecoration: 'none', fontWeight: 500 }}
            onClick={e => e.stopPropagation()}
          >
            @{part.value}
          </Link>
        ) : (
          <span key={i}>{part.value}</span>
        )
      )}
    </span>
  );
}
