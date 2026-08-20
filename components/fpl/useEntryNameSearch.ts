'use client'

import { classifyEntryLookupInput } from '@/lib/fpl-binding-core'
import { searchEntriesByName, type EntryNameSearchHit } from '@/lib/fpl-entry-search'
import { GraphQLRequestError } from '@/lib/graphql-client'
import { useRef, useState } from 'react'

export function useEntryNameSearch() {
	const [hits, setHits] = useState<EntryNameSearchHit[]>([])
	const [errorKey, setErrorKey] = useState<
		null | 'empty' | 'too-short' | 'too-long' | 'none' | 'failed'
	>(null)
	const [searching, setSearching] = useState(false)
	const requestId = useRef(0)

	const clear = () => {
		requestId.current += 1
		setHits([])
		setErrorKey(null)
		setSearching(false)
	}

	const search = async (
		raw: string
	): Promise<{ mode: 'bind' } | { mode: 'searched'; hits: EntryNameSearchHit[] }> => {
		const classified = classifyEntryLookupInput(raw)
		if (classified.kind === 'id') {
			clear()
			return { mode: 'bind' }
		}

		const id = ++requestId.current
		setSearching(true)
		setHits([])
		if (classified.kind === 'invalid') {
			setErrorKey(classified.reason)
			setSearching(false)
			return { mode: 'searched', hits: [] }
		}

		setErrorKey(null)
		try {
			const nextHits = await searchEntriesByName(classified.query)
			if (id !== requestId.current) return { mode: 'searched', hits: [] }
			setHits(nextHits)
			setErrorKey(nextHits.length === 0 ? 'none' : null)
			return { mode: 'searched', hits: nextHits }
		} catch (error) {
			if (id !== requestId.current) return { mode: 'searched', hits: [] }
			if (error instanceof GraphQLRequestError && error.code === 'REQUEST_CANCELLED') {
				return { mode: 'searched', hits: [] }
			}
			setHits([])
			setErrorKey('failed')
			return { mode: 'searched', hits: [] }
		} finally {
			if (id === requestId.current) setSearching(false)
		}
	}

	return { hits, errorKey, searching, search, clear }
}
