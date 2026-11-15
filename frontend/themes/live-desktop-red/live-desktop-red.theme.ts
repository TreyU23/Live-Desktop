// The live-desktop-red theme. `astryx experimental theme editor` wrote this file once and never changes it again.
// The checked settings live in live-desktop-red.settings.json and the generated live-desktop-red.settings.ts;
// change them with `astryx experimental theme editor set live-desktop-red ...`. Add your own changes below: they win over the settings.
import {defineTheme} from '@astryxdesign/core/theme';
import {liveDesktopRedSettings} from './live-desktop-red.settings';

export const liveDesktopRedTheme = defineTheme({
  extends: liveDesktopRedSettings,
  name: 'live-desktop-red',
});
