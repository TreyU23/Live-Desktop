export const system = {
  host: { name: 'SYNTHETIC-PC', user: 'Test profile', os: 'Windows 11', osVersion: '24H2', architecture: 'x64', javaVersion: 21 },
  resources: {
    cpuPercent: 24,
    memoryUsedBytes: 29.1 * 2 ** 30,
    memoryTotalBytes: 32 * 2 ** 30,
    storageUsedBytes: 420 * 2 ** 30,
    storageTotalBytes: 1000 * 2 ** 30,
    network: {
      connected: true,
      name: 'Synthetic network',
      address: '192.0.2.10',
      rxBytesPerSec: 120_000,
      txBytesPerSec: 45_000,
      ratesAvailable: true,
    },
    battery: { available: false, percent: null, detail: 'No battery reported by Windows' },
    diskActivity: { available: true, readBytesPerSec: 2_000_000, writeBytesPerSec: 500_000 },
  },
  controls: ['wifi', 'bluetooth', 'focus', 'night-light', 'microphone', 'battery-saver'].map(id => ({ id, available: true, enabled: id === 'wifi', direct: ['wifi', 'bluetooth'].includes(id), detail: ['wifi', 'bluetooth'].includes(id) ? 'Synthetic radio' : 'Windows Settings' })),
  device: { manufacturer: 'Synthetic', model: 'Workstation', processorName: 'Synthetic 16-core processor', processorCores: 16, processorLogicalProcessors: 32, installedMemoryBytes: 32 * 2 ** 30, graphics: [{ name: 'Synthetic graphics', driverVersion: '1.0' }], deviceId: 'SYNTHETIC-DEVICE-ID', productId: 'SYNTHETIC-PRODUCT-ID', systemType: 'x64-based PC' },
  windows: { edition: 'Windows 11', version: '24H2', build: 'Synthetic build', architecture: 'x64', installedOn: '2026-01-15' },
};
export const actions = [
  { id: 'radio', kind: 'windows_set_control', arguments: { control: 'wifi', enabled: false }, reason: 'Turn off Wi-Fi', status: 'pending' },
  { id: 'file', kind: 'workspace_write_file', arguments: { path: 'notes/synthetic.txt', content: '<script>Text only</script>\n' + 'Long review content. '.repeat(110) }, reason: 'Save a local note', status: 'pending' },
  { id: 'web', kind: 'browser_open_url', arguments: { url: 'https://example.com/a/../b' }, reason: 'Open a website', status: 'pending' },
  { id: 'settings', kind: 'windows_open_uri', arguments: { uri: 'ms-settings:nightlight' }, reason: 'Open Night light settings', status: 'completed' },
  { id: 'remember', kind: 'remember', arguments: { category: 'preference', content: 'Synthetic preference' }, reason: 'Remember a preference', status: 'failed', error: 'Synthetic execution failure' },
  { id: 'unknown', kind: 'future_kind', arguments: { content: 'Unknown action' }, reason: 'Unsupported action', status: 'rejected' },
].map(action => ({ ...action, createdAt: '2026-11-01T14:00:00Z' }));

export async function mockDashboard(page, overrides = {}) {
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (['embed.music.apple.com', 'open.spotify.com'].includes(url.hostname)) return route.fulfill({ contentType: 'text/html', body: '<p>Synthetic provider boundary</p>' });
    if (!url.pathname.startsWith('/api/') && url.pathname !== '/health') return route.continue();
    if (overrides.handle && await overrides.handle(route, url)) return;
    const bodies = {
      '/health': { status: 'ok', openAiConfigured: false },
      '/api/system': system,
      '/api/runtime': { backendOnline: true, frontendOnline: true },
      '/api/profile/settings': { openAiConfigured: false, profileApiKey: false },
      '/api/system/apps': [{ id: 'code', name: 'Visual Studio Code', detail: 'Synthetic workspace', icon: 'code', running: true }, { id: 'edge', name: 'Microsoft Edge', detail: 'Synthetic browser', icon: 'edge', running: false }],
      '/api/actions': actions,
      '/api/memories': [{ id: 'm1', category: 'project', content: 'Synthetic project notes for layout verification.' }],
      '/api/conversations': [{ id: 'c1', title: 'Synthetic conversation', messageCount: 2 }],
      '/api/conversations/c1': { id: 'c1', title: 'Synthetic conversation', messages: [{ id: '1', role: 'user', content: 'What is running on this PC?' }, { id: '2', role: 'assistant', content: 'Synthetic response for layout verification.' }] },
      '/api/integrations/phone-link': { installed: true, connected: true, deviceName: 'Synthetic phone', osName: 'iOS', model: 'iPhone', batteryPercent: null, detail: 'Connected; synthetic metadata', capturedAt: new Date().toISOString() },
      '/api/integrations/media-session': { available: false, ready: false, title: 'Nothing playing', artist: 'Apple Music', album: 'Start a track in your player', elapsed: 0, duration: 0, artwork: '/assets/album-cover.png' },
      '/api/integrations/icloud-calendar': { connected: true, status: 'connected', date: url.searchParams.get('date'), detail: 'Synthetic calendar', capturedAt: new Date().toISOString(), events: [{ id: 'all', title: 'Synthetic all-day event', allDay: true }, { id: 'event', title: 'Synthetic work session', start: `${url.searchParams.get('date')}T14:00:00`, end: `${url.searchParams.get('date')}T15:00:00` }] },
    };
    try { await route.fulfill({ json: bodies[url.pathname] ?? [] }); } catch { /* A newer selection can abort a read. */ }
  });
}
