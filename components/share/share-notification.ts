'use client'

import { toast, type ExternalToast } from 'sonner'

const SHARE_NOTIFICATION_ID = 'share-notification'
const SHARE_NOTIFICATION_OPTIONS: ExternalToast = {
	id: SHARE_NOTIFICATION_ID,
	duration: 2400,
}

/**
 * Keep text and image sharing feedback on the same notification lifecycle.
 * A shared id prevents a rapid text -> image share from leaving stacked,
 * competing notifications on the page.
 */
export function notifyShareSuccess(message: string) {
	toast.success(message, SHARE_NOTIFICATION_OPTIONS)
}

export function notifyShareWarning(message: string) {
	toast.warning(message, SHARE_NOTIFICATION_OPTIONS)
}
