export async function publishEvent(relayUrl, event) {
  const response = await fetch(`${relayUrl.replace(/\/$/, '')}/v1/events`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(event)
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `publish failed: ${response.status}`);
  }
  return response.json();
}

export async function loadPins(relayUrl, tile = '') {
  const url = new URL(`${relayUrl.replace(/\/$/, '')}/v1/events`);
  url.searchParams.set('kind', 'resource_pin');
  if (tile) url.searchParams.set('tile', tile);
  const response = await fetch(url.toString());
  const data = await response.json();
  return data.events || [];
}

export function subscribePins(relayUrl, onEvent, tile = '') {
  const url = new URL(`${relayUrl.replace(/\/$/, '')}/v1/stream`);
  url.searchParams.set('kind', 'resource_pin');
  if (tile) url.searchParams.set('tile', tile);
  const source = new EventSource(url.toString());
  source.addEventListener('event', (msg) => {
    try { onEvent(JSON.parse(msg.data)); } catch {}
  });
  return () => source.close();
}
