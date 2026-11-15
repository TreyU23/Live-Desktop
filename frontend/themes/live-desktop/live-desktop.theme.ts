// The live-desktop theme. `astryx experimental theme editor` wrote this file once and never changes it again.
// The checked settings live in live-desktop.settings.json and the generated live-desktop.settings.ts;
// change them with `astryx experimental theme editor set live-desktop ...`. Add your own changes below: they win over the settings.
import {defineTheme} from '@astryxdesign/core/theme';
import {liveDesktopSettings} from './live-desktop.settings';

export const liveDesktopTheme = defineTheme({
  extends: liveDesktopSettings,
  name: 'live-desktop',
});
