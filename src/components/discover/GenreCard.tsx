import { Link } from 'react-router-dom';
import { colors, fontSize, fontWeight, radius, space, transition } from '../../styles/tokens';
import { getGenreColor } from '../../styles/tokens';

interface GenreCardProps {
  name: string;
  count?: number;
}

export function GenreCard({ name, count }: GenreCardProps) {
  const genreColor = getGenreColor(name);
  return (
    <Link
      to={`/search?q=${encodeURIComponent(name)}`}
      style={{
        textDecoration: 'none',
        display: 'block',
        flexShrink: 0,
        scrollSnapAlign: 'start',
      }}
    >
      <div
        style={{
          minWidth: 140,
          padding: `${space[6]}px ${space[7]}px`,
          background: `${genreColor}14`,
          border: `1px solid ${genreColor}44`,
          borderRadius: radius.lg,
          color: genreColor,
          transition: `border-color ${transition.fast}, background ${transition.fast}`,
          textAlign: 'center',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = genreColor;
          e.currentTarget.style.background = `${genreColor}22`;
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = `${genreColor}44`;
          e.currentTarget.style.background = `${genreColor}14`;
        }}
      >
        <div
          style={{
            fontSize: fontSize.md,
            fontWeight: fontWeight.bold,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={name}
        >
          {name}
        </div>
        {count !== undefined && count > 0 && (
          <div style={{ fontSize: fontSize.sm, color: colors.text.dim, marginTop: space[1] }}>
            {count} mixes
          </div>
        )}
      </div>
    </Link>
  );
}
