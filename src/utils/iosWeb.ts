export type IosWebDisplayMode = 'browser' | 'standalone' | 'other'

export const isIosWebEnvironment = () => {
  if (typeof navigator === 'undefined') return false

  const userAgent = navigator.userAgent || ''
  const platform = navigator.platform || ''
  const isAppleMobile = /iPad|iPhone|iPod/i.test(userAgent)
  const isDesktopUaIpad = platform === 'MacIntel' && navigator.maxTouchPoints > 1

  return isAppleMobile || isDesktopUaIpad
}

export const isStandaloneWebApp = () => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false

  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean }
  return window.matchMedia('(display-mode: standalone)').matches || navigatorWithStandalone.standalone === true
}

export const getIosWebDisplayMode = (): IosWebDisplayMode => {
  if (!isIosWebEnvironment()) return 'other'
  return isStandaloneWebApp() ? 'standalone' : 'browser'
}
