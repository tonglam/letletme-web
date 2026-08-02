import { PageState } from '@/components/feedback/PageState'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import { ArrowLeft, SearchX } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

export default async function NotFound() {
	const t = await getTranslations('NotFound')

	return (
		<PageState
			icon={SearchX}
			title={t('title')}
			description={t('description')}
			actions={
				<Button asChild>
					<Link href="/">
						<ArrowLeft data-icon="inline-start" />
						{t('back')}
					</Link>
				</Button>
			}
		/>
	)
}
