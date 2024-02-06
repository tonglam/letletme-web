'use client'

import NavLinks from '@/components/navbar/NavLinks'
import { useCallback, useState } from 'react'
import { Menu } from 'react-daisyui'

function NavSideBar() {
	const [openSideLive, setOpenSideLive] = useState(false)
	const toggleLiveOpen = useCallback(() => {
		setOpenSideLive(val => !val)
	}, [setOpenSideLive])

	const [openSideSummary, setOpenSideSummary] = useState(false)
	const toggleSummaryOpen = useCallback(() => {
		setOpenSideSummary(val => !val)
	}, [setOpenSideSummary])

	const [openSideStat, setOpenSideStat] = useState(false)
	const toggleStatOpen = useCallback(() => {
		setOpenSideStat(val => !val)
	}, [setOpenSideStat])

	return (
		<section>
			<Menu>
				<Menu.Item>
					<Menu.Dropdown
						label="实时"
						onClick={toggleLiveOpen}
						open={openSideLive}
					>
						{NavLinks.liveLinks.map(component => (
							<Menu.Item key={component.title}>
								<a href={component.href}>{component.title}</a>
							</Menu.Item>
						))}
					</Menu.Dropdown>
					<Menu.Dropdown
						label="统计"
						onClick={toggleSummaryOpen}
						open={openSideSummary}
					>
						{NavLinks.summaryLinks.map(component => (
							<Menu.Item key={component.title}>
								<a href={component.href}>{component.title}</a>
							</Menu.Item>
						))}
					</Menu.Dropdown>
					<Menu.Dropdown
						label="数据"
						onClick={toggleStatOpen}
						open={openSideStat}
					>
						{NavLinks.statLinks.map(component => (
							<Menu.Item key={component.title}>
								<a href={component.href}>{component.title}</a>
							</Menu.Item>
						))}
					</Menu.Dropdown>
				</Menu.Item>
			</Menu>
		</section>
	)
}

export default NavSideBar
