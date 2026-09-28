// Client seats for M11. The host calls registerPrivacyClient(); nothing in client/index.ts does yet.

import { registerProfileSection, registerSettingsSection } from '../registry.ts'
import { SensitiveConsentScreen } from './consent-screen.ts'
import { DataPage } from './data-page.ts'

export function registerPrivacyClient(): void {
  registerSettingsSection({ id: 'longpi-privacy', order: 35, Component: DataPage })
  registerProfileSection({ id: 'longpi-privacy', order: 80, Component: DataPage })
}

export { SensitiveConsentScreen, DataPage }
