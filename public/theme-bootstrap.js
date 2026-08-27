(() => {
	// This external beforeInteractive script owns the tiny shell interaction
	// layer without adding a React-rendered inline <script> to the layout.
	const disclosureSelector = 'details[data-navigation-disclosure]'
	const shellRadioGroupSelector =
		'[data-theme-picker] [role="radiogroup"], [data-locale-picker] [role="radiogroup"]'
	const shellReadyEvent = 'letletme:shell-ready'
	const themeChoices = new Set(['light', 'dark', 'system'])
	const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)')
	let shellControlsEnabled = false

	const closeDisclosures = (except, restoreFocus = false) => {
		document.querySelectorAll(disclosureSelector).forEach(disclosure => {
			if (disclosure === except) return
			const focusWasInside =
				restoreFocus &&
				disclosure.hasAttribute('open') &&
				document.activeElement instanceof Node &&
				disclosure.contains(document.activeElement)
			disclosure.removeAttribute('open')
			if (focusWasInside) {
				disclosure.querySelector(':scope > summary')?.focus()
			}
		})
	}

	const readTheme = () => {
		try {
			const storedTheme = window.localStorage.getItem('theme')
			return themeChoices.has(storedTheme) ? storedTheme : 'system'
		} catch {
			return 'system'
		}
	}

	const updateThemeControls = theme => {
		document.querySelectorAll('[data-theme-choice]').forEach(choice => {
			const selected = choice.getAttribute('data-theme-choice') === theme
			choice.setAttribute('aria-checked', selected ? 'true' : 'false')
			if (choice instanceof HTMLElement) choice.tabIndex = selected ? 0 : -1
		})
	}

	const enableShellControls = () => {
		if (shellControlsEnabled) return
		shellControlsEnabled = true
		document.querySelectorAll('[data-theme-picker]').forEach(picker => {
			picker.removeAttribute('inert')
			picker.setAttribute('aria-disabled', 'false')
		})
		updateThemeControls(readTheme())
		document.querySelectorAll(shellRadioGroupSelector).forEach(group => {
			const choices = Array.from(
				group.querySelectorAll('[role="radio"]')
			).filter(choice => choice instanceof HTMLElement)
			const selected =
				choices.find(choice => choice.getAttribute('aria-checked') === 'true') ??
				choices[0]
			choices.forEach(choice => {
				choice.tabIndex = choice === selected ? 0 : -1
			})
		})
		document.querySelectorAll('[data-locale-link]').forEach(link => {
			if (!(link instanceof HTMLAnchorElement)) return
			const target = new URL(link.href, window.location.href)
			target.search = window.location.search
			target.hash = window.location.hash
			link.href = target.href
		})
	}

	const suppressThemeTransitions = () => {
		const style = document.createElement('style')
		style.setAttribute('data-theme-transition-guard', '')
		style.textContent = '*,*::before,*::after{transition:none!important}'
		document.head.append(style)
		return () =>
			requestAnimationFrame(() => requestAnimationFrame(() => style.remove()))
	}

	const applyTheme = (theme, suppressTransitions = false) => {
		const restoreTransitions = suppressTransitions
			? suppressThemeTransitions()
			: null
		const resolvedTheme =
			theme === 'system'
				? colorSchemeQuery.matches
					? 'dark'
					: 'light'
				: theme
		document.documentElement.classList.remove('light', 'dark')
		document.documentElement.classList.add(resolvedTheme)
		document.documentElement.style.colorScheme = resolvedTheme
		if (shellControlsEnabled) updateThemeControls(theme)
		restoreTransitions?.()
	}

	try {
		applyTheme(readTheme())
	} catch {}

	document.addEventListener('click', event => {
		const target = event.target
		if (!(target instanceof Element)) return

		const themeChoice = target.closest('[data-theme-choice]')
		if (themeChoice) {
			const theme = themeChoice.getAttribute('data-theme-choice')
			if (themeChoices.has(theme)) {
				try {
					window.localStorage.setItem('theme', theme)
				} catch {}
				applyTheme(theme, true)
				const disclosure = themeChoice.closest(disclosureSelector)
				disclosure?.removeAttribute('open')
				disclosure?.querySelector(':scope > summary')?.focus()
			}
			return
		}

		const disclosure = target.closest(disclosureSelector)
		if (!disclosure) {
			closeDisclosures()
			return
		}
		if (target.closest('summary')) closeDisclosures(disclosure)
		const anchor = target.closest('a')
		if (anchor) {
			const modified =
				event.button !== 0 ||
				event.metaKey ||
				event.ctrlKey ||
				event.shiftKey ||
				event.altKey ||
				anchor.target === '_blank' ||
				anchor.hasAttribute('download')
			if (!modified) {
				queueMicrotask(() => {
					if (!event.defaultPrevented) disclosure.removeAttribute('open')
				})
			}
		} else if (target.closest('[role="radio"]')) {
			disclosure.removeAttribute('open')
		}
	})

	document.addEventListener('keydown', event => {
		if (event.defaultPrevented) return
		const target = event.target
		const radio =
			target instanceof Element ? target.closest('[role="radio"]') : null
		const group = radio?.closest('[role="radiogroup"]')
		const shellPicker = group?.closest(
			'[data-theme-picker], [data-locale-picker]'
		)
		if (
			radio &&
			group &&
			shellPicker &&
			[
				'ArrowDown',
				'ArrowRight',
				'ArrowUp',
				'ArrowLeft',
				'Home',
				'End'
			].includes(event.key)
		) {
			const choices = Array.from(
				group.querySelectorAll('[role="radio"]')
			).filter(
				choice =>
					choice instanceof HTMLElement &&
					!(choice instanceof HTMLButtonElement && choice.disabled) &&
					choice.getAttribute('aria-disabled') !== 'true'
			)
			const currentIndex = choices.indexOf(radio)
			if (currentIndex >= 0 && choices.length > 0) {
				event.preventDefault()
				let nextIndex
				if (event.key === 'Home') nextIndex = 0
				else if (event.key === 'End') nextIndex = choices.length - 1
				else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
					nextIndex = (currentIndex + 1) % choices.length
				} else {
					nextIndex =
						(currentIndex - 1 + choices.length) % choices.length
				}
				choices[nextIndex].focus()
				choices[nextIndex].click()
			}
			return
		}
		if (event.key === 'Escape') closeDisclosures(undefined, true)
	})

	colorSchemeQuery.addEventListener('change', () => {
		if (readTheme() === 'system') applyTheme('system', true)
	})

	if (document.documentElement.hasAttribute('data-shell-hydrated')) {
		enableShellControls()
	} else {
		document.addEventListener(shellReadyEvent, enableShellControls, {
			once: true
		})
	}
})()
