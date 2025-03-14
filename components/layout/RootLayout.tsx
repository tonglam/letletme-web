'use client'

import { ReactNode } from 'react'

interface RootLayoutProps {
	children: ReactNode
	className?: string
}

export default function RootLayout({ children, className }: RootLayoutProps) {
	return (
		<div className={`min-h-screen bg-background ${className || ''}`}>
			{children}
		</div>
	)
}
