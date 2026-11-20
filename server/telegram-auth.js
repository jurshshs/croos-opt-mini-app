import { createPublicKey, verify } from 'node:crypto';

const telegramKey = createPublicKey({
  key: Buffer.from('302a300506032b6570032100e7bf03a2fa4602af4580703d88dda5bb59f32ed8b02a56c187fe7d34caed242d', 'hex'),
  format: 'der', type: 'spki',
});

export function verifiedUser(initData, token) {
  const botId = token?.split(':', 1)[0];
  if (!/^\d+$/.test(botId || '')) return null;
  if (typeof initData !== 'string' || initData.length > 8192) return null;
  const params = new URLSearchParams(initData);
  const signature = params.get('signature');
  if (!signature || !/^[\w-]{86}(?:==)?$/.test(signature) || new Set(params.keys()).size !== [...params.keys()].length) return null;
  params.delete('hash');
  params.delete('signature');
  params.sort();
  const data = [...params].map(([key, value]) => `${key}=${value}`).join('\n');
  const signedData = Buffer.from(`${botId}:WebAppData\n${data}`);
  if (!verify(null, signedData, telegramKey, Buffer.from(signature, 'base64url'))) return null;
  const age = Date.now() / 1000 - Number(params.get('auth_date'));
  if (!Number.isFinite(age) || age < -60 || age > 3600) return null;
  try {
    const user = JSON.parse(params.get('user'));
    return Number.isSafeInteger(user?.id) && user.id > 0 ? user : null;
  } catch {
    return null;
  }
}
