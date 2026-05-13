/**
 * Tailwind CSS class-name merge utility.
 *
 * Combines `clsx` conditional joining with `tailwind-merge` deduplication
 * so conflicting Tailwind classes resolve correctly.
 *
 * @module utils
 */

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Merge and deduplicate CSS class names.
 *
 * @param inputs - Class values (strings, arrays, objects) to merge.
 * @returns A single deduplicated class string.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
