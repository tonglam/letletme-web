import { create } from 'zustand'

interface OpenNavState {
	openNav: boolean
	handleNav: () => void
}

const useStore = create<OpenNavState>()(set => ({
	openNav: false,
	handleNav: () => set(state => ({ openNav: !state.openNav }))
}))

export default useStore
