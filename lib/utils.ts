import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Open a native date/time input's picker; showPicker where available, click fallback. */
export function openNativePicker(input: HTMLInputElement | null) {
  if (!input) return
  if (typeof input.showPicker === "function") {
    input.showPicker()
  } else {
    input.click()
  }
}
