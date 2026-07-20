export const USERS: Record<string, { password: string; role: 'admin' | 'affiliate'; utm: string; name: string; handle: string }> = {
  'amplify': { password: '12345', role: 'admin', utm: '', name: 'Amplify', handle: '' },
  'giselecorreia': { password: '12345', role: 'affiliate', utm: 'giselecorreia', name: 'Gisele Correia', handle: '@delymarkets' },
  'jota_': { password: '12345', role: 'affiliate', utm: 'jota_', name: 'Jota', handle: '@jota_' },
  'andreeleia_': { password: '12345', role: 'affiliate', utm: 'andreeleia_', name: 'André & Leia', handle: '@andreeleia_' },
  'glow.fit1': { password: '12345', role: 'affiliate', utm: 'glow.fit1', name: 'Glow Fit', handle: '@glowfit.club1' },
}
export type UserProfile = typeof USERS[string]
