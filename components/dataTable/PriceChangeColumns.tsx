'use client'

import { Badge } from '@/components/ui/badge'
import { PriceChangeResData, PriceChangeType } from '@/types/globals'
import { ColumnDef } from '@tanstack/react-table'
import {
	IoIosAddCircle,
	IoMdArrowDropdownCircle,
	IoMdArrowDropupCircle
} from 'react-icons/io'

export const PriceChangeColumns: ColumnDef<PriceChangeResData>[] = [
	{
		accessorKey: 'webName',
		header: 'Player',
		cell: ({ row }) => {
			console.log(row.getValue('changeType'))

			return (
				<div className="flex items-center space-x-2 font-bold">
					{(() => {
						switch (row.getValue('changeType')) {
							case PriceChangeType.Rise:
								return (
									<IoMdArrowDropupCircle
										size={20}
										color="red"
									/>
								)
							case PriceChangeType.Faller:
								return (
									<IoMdArrowDropdownCircle
										size={20}
										color="red"
									/>
								)
							case PriceChangeType.Start:
								return (
									<IoIosAddCircle
										size={20}
										color="gray"
									/>
								)
							default:
								return null
						}
					})()}
					{row.getValue('webName')}
				</div>
			)
		}
	},
	{
		accessorKey: 'teamShortName',
		header: 'Club',
		cell: ({ row }) => {
			return <Badge>{row.getValue('teamShortName')}</Badge>
		}
	},
	{
		accessorKey: 'value',
		header: 'Price',
		cell: ({ row }) => {
			const value = parseFloat(row.getValue('value'))

			return <div className="text-center">{value + 'm'}</div>
		}
	},
	{
		accessorKey: 'lastValue',
		header: 'Old',
		cell: ({ row }) => {
			const value = parseFloat(row.getValue('lastValue'))

			return (
				<div className={'text-center'}>{value === 0 ? '-' : `${value}m`}</div>
			)
		}
	},
	{ accessorKey: 'changeType', header: 'ChangeType' }
]
