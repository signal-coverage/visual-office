import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Joins class names, letting the last Tailwind utility win. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
