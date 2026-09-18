'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { RouteReadyMarker } from '@/components/analytics/RouteReadyMarker'

type Region = 'price' | 'glance'
const MarketReadyContext = createContext<((region: Region, mounted: boolean) => void) | null>(null)

export function MarketReadiness({ children }: { children: ReactNode }) {
 const [regions, setRegions] = useState({ price: false, glance: false })
 const [report] = useState(() => (region: Region, mounted: boolean) => {
  setRegions(current => current[region] === mounted ? current : { ...current, [region]: mounted })
 })
 return (
  <MarketReadyContext.Provider value={report}>
   {children}
   <RouteReadyMarker name="MARKET_CONTENT_READY" audienceHint="public" ready={regions.price && regions.glance} goodMs={1_000} poorMs={1_500} />
  </MarketReadyContext.Provider>
 )
}

// This component belongs inside the consumer's Suspense boundary, never its fallback.
export function MarketRegionReady({ region }: { region: Region }) {
 const report = useContext(MarketReadyContext)
 useEffect(() => {
  report?.(region, true)
  return () => report?.(region, false)
 }, [region, report])
 return null
}
