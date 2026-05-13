/**
 * Hook that tracks whether the viewport is at or below the mobile breakpoint.
 *
 * @module use-mobile
 */

import * as React from "react"

/** Width threshold (px) below which the layout is considered mobile. */
const MOBILE_BREAKPOINT = 768

/**
 * Returns `true` when the viewport width is below {@link MOBILE_BREAKPOINT}.
 *
 * @returns Whether the current viewport qualifies as mobile.
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
