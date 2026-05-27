'use client'

import dynamic from 'next/dynamic'

const MixHiveClient = dynamic(() => import('../../MixHiveClient'), {
  ssr: false,
  loading: () => (
    <main className="hive-boot">
      <div className="hive-boot__mark">MIXHIVE</div>
      <div className="hive-boot__scan" />
    </main>
  ),
})

export default function Page() {
  return <MixHiveClient />
}
