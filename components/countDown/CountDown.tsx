import { useCountdown } from '@/hooks/useCountDown'
import { Countdown } from 'react-daisyui'

export const CountDown = ({ utcTime }: { utcTime: string }) => {
	const [days, hours, minutes, seconds] = useCountdown(utcTime)

	const boxStyle =
			'flex flex-col bg-emerald-400 rounded-box justify-items-center text-white-content size-16 lg:size-24 px-3 pt-2 lg:pt-4',
		fontStyle = 'font-mono text-3xl lg:text-5xl pl-0.5 lg:pl-1.5'

	return (
		<section>
			<div className="flex space-x-2 text-center">
				<div className={boxStyle}>
					<Countdown
						className={fontStyle}
						value={days}
					/>
					day
				</div>
				<div className={boxStyle}>
					<Countdown
						className={fontStyle}
						value={hours}
					/>
					hour
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
