'use client'

import { Table } from 'react-daisyui'
import { IoMdArrowDropupCircle } from 'react-icons/io'

function PriceChangeTable() {
	return (
		<>
			<Table className="rounded-box overflow-x-auto">
				<Table.Head>
					<span />
					<span>Player</span>
					<span>Club</span>
					<span>Price</span>
					<span>Old Price</span>
				</Table.Head>

				<Table.Body onClick={() => console.log('todo, handle row click')}>
					<Table.Row>
						<div>
							<IoMdArrowDropupCircle
								size={20}
								color="green"
							/>
						</div>
						<div className="text-pretty font-bold">Saka</div>
						<div>ARS</div>
						<div>7.2m</div>
						<div>7.1m</div>
					</Table.Row>

					<Table.Row>
						<div>
							<IoMdArrowDropupCircle
								size={20}
								color="green"
							/>
						</div>
						<div className="text-pretty font-bold">Bertrand Traoré</div>
						<div>ARS</div>
						<div>7.2m</div>
						<div>7.1m</div>
					</Table.Row>

					<Table.Row>
						<div>
							<IoMdArrowDropupCircle
								size={20}
								color="green"
							/>
						</div>
						<div className="text-pretty font-bold">Peacock-Farrell</div>
						<div>ARS</div>
						<div>7.2m</div>
						<div>7.1m</div>
					</Table.Row>
				</Table.Body>
			</Table>
		</>
	)
}

export { PriceChangeTable }
