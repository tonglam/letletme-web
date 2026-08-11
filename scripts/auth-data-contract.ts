import { createHash } from 'node:crypto'

import postgres from 'postgres'

type QueryClient = postgres.Sql | postgres.TransactionSql

type RelationIdentity = {
	relation_name: string
}

export type AuthRelationDigest = {
	relation: string
	rowCount: string
	contentHash: string
}

export type AuthDataManifest = {
	relations: AuthRelationDigest[]
}

function quoteIdentifier(identifier: string): string {
	return `"${identifier.replaceAll('"', '""')}"`
}

export async function loadAuthDataManifest(
	client: QueryClient
): Promise<AuthDataManifest> {
	const identities = await client<RelationIdentity[]>`
		SELECT relation_row.relname AS relation_name
		FROM pg_class relation_row
		JOIN pg_namespace namespace_row ON namespace_row.oid = relation_row.relnamespace
		WHERE namespace_row.nspname = 'bauth'
			AND relation_row.relkind IN ('r', 'p')
			AND relation_row.relname <> '__drizzle_migrations'
		ORDER BY relation_row.relname
	`

	const relations: AuthRelationDigest[] = []
	for (const identity of identities) {
		const qualifiedName = `bauth.${quoteIdentifier(identity.relation_name)}`
		const [digest] = await client.unsafe<
			{ row_count: string; content_hash: string }[]
		>(`
			SELECT
				count(*)::text AS row_count,
				md5(COALESCE(string_agg(row_hash, '' ORDER BY row_hash), '')) AS content_hash
			FROM (
				SELECT md5(to_jsonb(source_row)::text) AS row_hash
				FROM ${qualifiedName} source_row
			) hashed_rows
		`)
		if (!digest) throw new Error(`Failed to hash bauth.${identity.relation_name}`)
		relations.push({
			relation: `bauth.${identity.relation_name}`,
			rowCount: digest.row_count,
			contentHash: digest.content_hash
		})
	}

	return { relations }
}

export function serializeAuthDataManifest(manifest: AuthDataManifest): string {
	return JSON.stringify({
		relations: [...manifest.relations].sort((left, right) =>
			left.relation.localeCompare(right.relation)
		)
	})
}

export function fingerprintAuthDataManifest(manifest: AuthDataManifest): string {
	return createHash('sha256')
		.update(serializeAuthDataManifest(manifest), 'utf8')
		.digest('hex')
}
