import { create } from "zustand"

interface UIState {
  displayAppDirectory: boolean
}

interface UIActions {
  setDisplayAppDirectory: (show: boolean) => void
  openAppDirectory: () => void
  closeAppDirectory: () => void
}

export interface UIStore extends UIState, UIActions {}

export const useUIStore = create<UIStore>((set) => ({
  // Initial state
  displayAppDirectory: false,

  // Actions
  setDisplayAppDirectory: (show: boolean) =>
    set({ displayAppDirectory: show }),

  openAppDirectory: () =>
    set({ displayAppDirectory: true }),

  closeAppDirectory: () =>
    set({ displayAppDirectory: false }),
}))