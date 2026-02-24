# Specification

## Summary
**Goal:** Add an always-visible "Download App / Install App" button to the app header that guides users through PWA installation regardless of browser support.

**Planned changes:**
- Update `InstallButton.tsx` so the button is always visible in the header, never conditionally hidden based on browser PWA prompt availability.
- When clicked, attempt the native `beforeinstallprompt` install flow via the existing `usePWAInstall` hook if available.
- If the native prompt is not available, display a modal with step-by-step manual installation instructions for Chrome (Add to Home Screen via browser menu), Safari (Share → Add to Home Screen), and Edge.
- Style the button and modal consistently with the existing golden color theme, ensuring correct layout on both mobile and desktop.

**User-visible outcome:** Users always see an "Install App" button in the header. Clicking it either triggers the native browser install prompt or shows clear, browser-specific instructions for manually adding the app to their home screen.
