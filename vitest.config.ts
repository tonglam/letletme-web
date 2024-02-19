// eslint-disable-next-line spaced-comment
/// <reference types="vitest" />

import react from '@vitejs/plugin-react'
import path from 'path'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
	plugins: [react()],
	test: {
		environment: 'jsdom',
		exclude: [...configDefaults.exclude, '.next']
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './')
		}
	}
})
