'use client'

import { useCountdown } from '@/hooks/useCountDown'
import { Countdown } from 'react-daisyui'

interface CountDownProps {
	utcTime: string
}

export function CountDown({ utcTime }: CountDownProps) {
	const [days, hours, minutes, seconds] = useCountdown(utcTime)

	const boxStyle =
			'flex flex-col p-3 bg-emerald-400 rounded-box text-white-content',
		fontStyle = 'font-mono text-6xl'

	return (
		<section>
			<div className="grid grid-flow-col gap-5 text-center auto-cols-max">
				<div className={boxStyle}>
					<Countdown
						className={fontStyle}
						value={days}
					/>
					days
				</div>
				<div className={boxStyle}>
					<Countdown
						className={fontStyle}
						value={hours}
					/>
					hours
				</div>
				<div className={boxStyle}>
					<Countdown
						className={fontStyle}
						value={minutes}
					/>
					min
				</div>
				<div className={boxStyle}>
					<Countdown
						className={fontStyle}
						value={seconds}
					/>
					sec
				</div>
			</div>
		</section>
	)
}
