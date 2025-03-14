'use client'

import { ReactNode } from 'react'

interface RootLayoutProps {
	children: ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
	return <div className="min-h-screen bg-background">{children}</div>
}
