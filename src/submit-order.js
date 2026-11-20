export async function notifyOrderGroup(order, initData) {
  try {
    const response = await fetch('/api/submit-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order, initData }),
      signal: AbortSignal.timeout(13000),
    });
    if (import.meta.env.DEV && !response.headers.get('content-type')?.includes('application/json')) return 'disabled';
    const { status } = await response.json();
    return ['sent', 'disabled', 'forbidden', 'invalid', 'failed'].includes(status) ? status : 'unknown';
  } catch {
    return 'unknown';
  }
}
