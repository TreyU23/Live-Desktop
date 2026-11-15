import { VStack } from '@astryxdesign/core/Layout';

// The one provider embed. App keeps it mounted after the first Music visit so playback survives
// navigation; on other views it is parked (clipped, inert, hidden from assistive tech) rather
// than unmounted. The wrapper element type never changes, so React never recreates the iframe.
// sandbox: providers need scripts, same-origin storage for sign-in, popups for sign-in windows
// and presentation for fullscreen; top navigation and form submission to other origins are not granted.
const kParked = {
  position: 'absolute',
  insetInlineStart: 0,
  inlineSize: 'var(--spacing-1)',
  blockSize: 'var(--spacing-1)',
  overflow: 'hidden',
  clipPath: 'inset(50%)',
  opacity: 0,
  pointerEvents: 'none',
};
const kAllow = {
  apple: 'autoplay *; encrypted-media *; fullscreen *; clipboard-write',
  spotify: 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture',
};
const kHeight = { apple: 450, spotify: 352 };

export function MusicFrame({ providerId, provider, embedUrl, isActive }) {
  return <VStack paddingInline={isActive ? 6 : 0} paddingBlockEnd={isActive ? 6 : 0} style={isActive ? undefined : kParked}
    aria-hidden={!isActive} inert={isActive ? undefined : true}>
    <iframe key={`${providerId}:${embedUrl}`} title={`${provider.name} web player`} src={embedUrl}
      width="100%" height={kHeight[providerId] || kHeight.apple}
      allow={kAllow[providerId] || kAllow.apple}
      sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation allow-storage-access-by-user-activation"
      referrerPolicy="strict-origin-when-cross-origin" loading="eager"
      style={{ border: 0, borderRadius: 'var(--radius-container)', display: 'block' }} />
  </VStack>;
}
