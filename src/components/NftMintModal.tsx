'use client';
import { useTranslations } from 'next-intl';

import { useState } from 'react';
import { Modal } from './ui/Modal';
import { HiveButton } from './hive/HiveButton';
import { colors, fontSize, space, fontWeight, radius } from '../styles/tokens';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export interface NftCollectionConfig {
  owner_id: string;
  name: string;
  description: string;
  image_url: string;
  max_supply?: number;
  soulbound?: boolean;
  mix_id?: string;
  quest_id?: string;
  event_node_id?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sourceType: 'mix' | 'quest' | 'event';
  sourceId: string;
  defaultConfig?: Partial<NftCollectionConfig>;
  onDeployed?: (collectionId: string) => void;
}

type Step = 'configure' | 'preview' | 'deploying' | 'done';

export function NftMintModal({
  isOpen,
  onClose,
  sourceType,
  sourceId,
  defaultConfig,
  onDeployed,
}: Props) {
  const t = useTranslations('nftMintModal');
  const [step, setStep] = useState<Step>('configure');
  const [name, setName] = useState(defaultConfig?.name ?? '');
  const [description, setDescription] = useState(defaultConfig?.description ?? '');
  const [maxSupply, setMaxSupply] = useState(defaultConfig?.max_supply ?? 50);
  const [soulbound, setSoulbound] = useState(defaultConfig?.soulbound ?? sourceType === 'event');
  const [collectionId, setCollectionId] = useState<string | null>(null);

  const reset = () => {
    setStep('configure');
    setName(defaultConfig?.name ?? '');
    setMaxSupply(defaultConfig?.max_supply ?? 50);
    setSoulbound(defaultConfig?.soulbound ?? sourceType === 'event');
    setCollectionId(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleDeploy = async () => {
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    setStep('deploying');

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      toast.error('Not signed in');
      setStep('configure');
      return;
    }

    // Require a connected wallet before minting (Settings → Web3 & NFTs)
    const { data: profile } = await supabase
      .from('profiles')
      .select('wallet_address')
      .eq('id', session.user.id)
      .single();
    if (!profile?.wallet_address) {
      toast.error('Connect a wallet first — go to Settings → Web3 & NFTs');
      setStep('configure');
      return;
    }

    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        description: description.trim() || null,
        max_supply: maxSupply > 0 ? maxSupply : null,
        soulbound,
        image_url: defaultConfig?.image_url ?? null,
      };
      if (sourceType === 'mix') body.mix_id = sourceId;
      if (sourceType === 'quest') body.quest_id = sourceId;
      if (sourceType === 'event') body.event_node_id = sourceId;

      const res = await fetch('/api/nft/collections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Deploy failed (${res.status})`);
      }

      const created = await res.json();
      setCollectionId(created.collection_id);
      setStep('done');
      onDeployed?.(created.collection_id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Deploy failed');
      setStep('configure');
    }
  };

  const title =
    step === 'configure'
      ? 'Mint a limited edition pass'
      : step === 'preview'
        ? 'Preview token'
        : step === 'deploying'
          ? 'Deploying…'
          : 'Collection live!';

  const description_ =
    step === 'configure'
      ? sourceType === 'event'
        ? 'Create soulbound participation proofs for attendees'
        : sourceType === 'quest'
          ? 'Let fans back your quest with a token'
          : 'Give early supporters a permanent, on-chain receipt'
      : step === 'done'
        ? 'Your collection is deploying on Base — tokens are claimable once confirmed.'
        : undefined;

  return (
    <Modal open={isOpen} onClose={handleClose} title={title} description={description_} width={520}>
      {step === 'configure' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: space[4] }}>
          <div>
            <label style={labelStyle}>Collection name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={
                sourceType === 'event' ? 'Berlin Warehouse — April 2026' : 'Early supporter pass'
              }
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>{t('description')}</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder={t('aLimitedReceiptOf')}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', gap: space[4] }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>{t('maxSupply')}</label>
              <input
                type="number"
                min={1}
                max={10000}
                value={maxSupply}
                onChange={e => setMaxSupply(parseInt(e.target.value) || 50)}
                style={inputStyle}
              />
              <span style={{ fontSize: fontSize.xs, color: colors.text.faint }}>
                {t('leave0ForUnlimited')}
              </span>
            </div>

            <div style={{ flex: 1 }}>
              <label style={labelStyle}>{t('soulboundNonTransferable')}</label>
              <div style={{ marginTop: 8 }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: space[2],
                    cursor: 'pointer',
                    fontSize: fontSize.sm,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={soulbound}
                    onChange={e => setSoulbound(e.target.checked)}
                    style={{ accentColor: colors.gold }}
                  />
                  <span>{t('soulboundToken')}</span>
                </label>
                <p style={{ fontSize: fontSize.xs, color: colors.text.faint, margin: '4px 0 0' }}>
                  {soulbound
                    ? 'Cannot be sold or transferred — pure provenance.'
                    : 'Holders can transfer or resell externally.'}
                </p>
              </div>
            </div>
          </div>

          <div
            style={{
              padding: space[3],
              background: 'rgba(240,192,64,0.07)',
              border: '1px solid rgba(240,192,64,0.2)',
              borderRadius: radius.sm,
              fontSize: fontSize.xs,
              color: colors.text.muted,
            }}
          >
            {t('tokensAreMintedOn')}<strong>{t('baseL2')}</strong> via Zora Protocol. Gas is covered
            by MIXHIVE — free to claim for holders. No secondary market is shown inside the app.
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: space[3],
              paddingTop: space[2],
            }}
          >
            <HiveButton variant="secondary" onClick={handleClose}>
              {t('cancel')}
            </HiveButton>
            <HiveButton
              variant="secondary"
              onClick={() => setStep('preview')}
              disabled={!name.trim()}
            >
              Preview →
            </HiveButton>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: space[4] }}>
          <TokenPreviewCard
            name={name}
            description={description}
            maxSupply={maxSupply}
            soulbound={soulbound}
            sourceType={sourceType}
            imageUrl={defaultConfig?.image_url}
          />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: space[2],
            }}
          >
            <HiveButton variant="secondary" onClick={() => setStep('configure')}>
              ← Edit
            </HiveButton>
            <HiveButton variant="primary" onClick={handleDeploy}>
              {t('deployOnBase')}
            </HiveButton>
          </div>
        </div>
      )}

      {step === 'deploying' && (
        <div style={{ textAlign: 'center', padding: `${space[8]}px 0` }}>
          <div
            style={{
              width: 48,
              height: 48,
              border: `3px solid ${colors.border}`,
              borderTopColor: colors.gold,
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto',
            }}
          />
          <p style={{ marginTop: space[4], color: colors.text.muted, fontSize: fontSize.sm }}>
            Uploading metadata to IPFS and deploying contract on Base…
          </p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {step === 'done' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: space[4] }}>
          <div style={{ textAlign: 'center', padding: `${space[4]}px 0` }}>
            <div style={{ fontSize: 40, marginBottom: space[3] }}>✅</div>
            <p style={{ color: colors.text.secondary, fontSize: fontSize.sm }}>
              {t('collection')}<strong>{name}</strong> is live. Fans can now claim tokens from the{' '}
              {sourceType} page.
            </p>
            {collectionId && (
              <p style={{ fontSize: fontSize.xs, color: colors.text.faint, marginTop: space[2] }}>
                Collection ID: {collectionId}
              </p>
            )}
          </div>
          <HiveButton variant="primary" onClick={handleClose} style={{ width: '100%' }}>
            {t('done')}
          </HiveButton>
        </div>
      )}
    </Modal>
  );
}

function TokenPreviewCard({
  name,
  description,
  maxSupply,
  soulbound,
  sourceType,
  imageUrl,
}: {
  name: string;
  description: string;
  maxSupply: number;
  soulbound: boolean;
  sourceType: 'mix' | 'quest' | 'event';
  imageUrl?: string;
}) {
  const t = useTranslations('nftMintModal');
  return (
    <div
      style={{
        background: colors.bg,
        border: `1px solid ${colors.borderStrong}`,
        borderRadius: radius.lg,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: 120,
          background: imageUrl
            ? `url(${imageUrl}) center/cover`
            : 'linear-gradient(135deg, #1a1a2e, #16213e)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {!imageUrl && <span style={{ fontSize: 40 }}>🎛️</span>}
      </div>
      <div style={{ padding: space[4] }}>
        <div style={{ fontWeight: fontWeight.bold, fontSize: fontSize.md, marginBottom: 4 }}>
          {name || 'Unnamed pass'}
        </div>
        {description && (
          <p style={{ fontSize: fontSize.sm, color: colors.text.muted, margin: '0 0 8px' }}>
            {description}
          </p>
        )}
        <div style={{ display: 'flex', gap: space[2], flexWrap: 'wrap' }}>
          <Tag label={`/${maxSupply > 0 ? maxSupply : '∞'} editions`} />
          <Tag label={soulbound ? 'Soulbound' : 'Transferable'} gold={soulbound} />
          <Tag
            label={
              sourceType === 'mix'
                ? 'Mix pass'
                : sourceType === 'quest'
                  ? 'Quest backing'
                  : 'Gig proof'
            }
            gold
          />
          <Tag label={t('baseL2')} />
        </div>
      </div>
    </div>
  );
}

function Tag({ label, gold }: { label: string; gold?: boolean }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 11,
        background: gold ? 'rgba(240,192,64,0.12)' : 'rgba(255,255,255,0.06)',
        color: gold ? colors.gold : colors.text.muted,
        border: `1px solid ${gold ? 'rgba(240,192,64,0.25)' : colors.border}`,
      }}
    >
      {label}
    </span>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: fontSize.sm,
  color: colors.text.secondary,
  marginBottom: 6,
  fontWeight: fontWeight.medium,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  background: colors.bg,
  border: `1px solid ${colors.border}`,
  borderRadius: radius.sm,
  color: colors.text.primary,
  fontSize: fontSize.md,
  boxSizing: 'border-box',
};
