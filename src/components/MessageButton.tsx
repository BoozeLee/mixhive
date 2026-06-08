import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getOrCreateDm, hasBlocked, isBlocked } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { colors, radius } from '../styles/tokens';

interface Props {
  targetUserId: string;
}

export function MessageButton({ targetUserId }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [blocked, setBlocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setChecking(false);
      return;
    }
    Promise.all([hasBlocked(user.id, targetUserId), isBlocked(user.id, targetUserId)]).then(
      ([hasB, isB]) => {
        setBlocked(hasB || isB);
        setChecking(false);
      }
    );
  }, [user, targetUserId]);

  async function handleClick() {
    if (!user || blocked || loading) return;
    setLoading(true);
    const conversationId = await getOrCreateDm(targetUserId);
    setLoading(false);
    if (conversationId) {
      navigate(`/messages/${conversationId}`);
    }
  }

  if (checking || blocked) return null;

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      style={{
        minHeight: 40,
        padding: '9px 22px',
        borderRadius: radius.md,
        border: `1px solid ${colors.borderStrong}`,
        background: colors.surface,
        color: colors.text.secondary,
        fontWeight: 700,
        cursor: 'pointer',
      }}
    >
      {loading ? '…' : 'Message'}
    </button>
  );
}
