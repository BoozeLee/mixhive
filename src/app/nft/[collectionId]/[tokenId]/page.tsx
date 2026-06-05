import { Metadata } from 'next';
import { createServerClient } from '@/lib/supabase';
import { notFound } from 'next/navigation';

interface Props {
  params: Promise<{ collectionId: string; tokenId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { collectionId, tokenId } = await params;
  const supabase = createServerClient();

  const { data: collection } = await supabase
    .from('nft_collections')
    .select('name, description, image_url')
    .eq('id', collectionId)
    .single();

  return {
    title: collection ? `${collection.name} — Pass #${tokenId} | MIXHIVE` : 'MIXHIVE NFT Pass',
    description: collection?.description ?? 'A MIXHIVE music NFT pass',
    openGraph: {
      images: collection?.image_url ? [collection.image_url] : [],
    },
  };
}

export default async function NftReceiptPage({ params }: Props) {
  const { collectionId, tokenId } = await params;
  const supabase = createServerClient();

  const { data: token } = await supabase
    .from('nft_tokens')
    .select(
      `
      id,
      token_id,
      holder_address,
      holder_profile,
      minted_at,
      tx_hash,
      soulbound,
      collection:nft_collections (
        id, name, description, image_url, chain, max_supply, soulbound, owner_id
      )
    `
    )
    .eq('collection_id', collectionId)
    .eq('token_id', parseInt(tokenId, 10))
    .maybeSingle();

  if (!token || !token.collection) return notFound();

  const collection = token.collection as {
    id: string;
    name: string;
    description: string | null;
    image_url: string | null;
    chain: string;
    max_supply: number | null;
    soulbound: boolean;
    owner_id: string;
  };

  const baseScanTx = token.tx_hash ? `https://basescan.org/tx/${token.tx_hash}` : null;

  const truncate = (addr: string) =>
    addr.length > 10 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#0a0a0a',
        color: '#eee',
        fontFamily: 'Inter, system-ui, sans-serif',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        padding: '48px 16px 96px',
      }}
    >
      <div style={{ maxWidth: 480, width: '100%' }}>
        {/* MIXHIVE wordmark */}
        <div
          style={{
            fontSize: 13,
            letterSpacing: 3,
            color: '#f0c040',
            marginBottom: 32,
            textTransform: 'uppercase',
          }}
        >
          MIXHIVE
        </div>

        {/* Collection artwork */}
        {collection.image_url && (
          <img
            src={collection.image_url}
            alt={collection.name}
            style={{
              width: '100%',
              aspectRatio: '1',
              objectFit: 'cover',
              borderRadius: 12,
              marginBottom: 24,
              border: '1px solid #222',
            }}
          />
        )}

        {/* Collection name + pass number */}
        <div style={{ marginBottom: 8 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#fff' }}>
            {collection.name}
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: '#888' }}>
            Pass #{token.token_id}
            {collection.max_supply && ` of ${collection.max_supply}`}
          </p>
        </div>

        {/* Soulbound badge */}
        {(token.soulbound || collection.soulbound) && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(240,192,64,0.1)',
              border: '1px solid rgba(240,192,64,0.3)',
              borderRadius: 999,
              padding: '4px 12px',
              fontSize: 12,
              color: '#f0c040',
              marginBottom: 24,
            }}
          >
            ⬡ Soulbound · Cannot be transferred
          </div>
        )}

        {/* Description */}
        {collection.description && (
          <p style={{ fontSize: 15, color: '#aaa', lineHeight: 1.6, marginBottom: 28 }}>
            {collection.description}
          </p>
        )}

        {/* Provenance details */}
        <div
          style={{
            background: '#111',
            border: '1px solid #222',
            borderRadius: 10,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <h2
            style={{
              margin: '0 0 16px',
              fontSize: 13,
              color: '#666',
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}
          >
            Provenance
          </h2>
          <dl
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              gap: '10px 16px',
              margin: 0,
            }}
          >
            <ProvenanceRow label="Chain" value="Base L2" />
            {token.holder_address && (
              <ProvenanceRow label="Holder" value={truncate(token.holder_address)} mono />
            )}
            {token.minted_at && (
              <ProvenanceRow
                label="Minted"
                value={new Date(token.minted_at).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              />
            )}
            {token.tx_hash && (
              <ProvenanceRow label="Tx hash" value={truncate(token.tx_hash)} mono />
            )}
          </dl>
        </div>

        {/* Verify on-chain */}
        {baseScanTx && (
          <a
            href={baseScanTx}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'block',
              textAlign: 'center',
              padding: '12px',
              border: '1px solid #333',
              borderRadius: 8,
              color: '#888',
              fontSize: 13,
              textDecoration: 'none',
              marginBottom: 32,
            }}
          >
            Verify on BaseScan ↗
          </a>
        )}

        <p style={{ fontSize: 12, color: '#444', textAlign: 'center' }}>
          This receipt is permanently stored on the Base blockchain. MIXHIVE does not show price
          data or enable trading.
        </p>
      </div>
    </main>
  );
}

function ProvenanceRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <>
      <dt style={{ fontSize: 13, color: '#666', margin: 0 }}>{label}</dt>
      <dd
        style={{
          fontSize: 13,
          color: '#ccc',
          margin: 0,
          fontFamily: mono ? 'monospace' : 'inherit',
        }}
      >
        {value}
      </dd>
    </>
  );
}
