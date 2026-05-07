
const STORAGE_KEYS = ['groundwork-okc-v2', 'groundwork-okc-v1'];
const ACTIVE_STORAGE_KEY = 'groundwork-okc-v2';
const DEFAULT_RELAYS = ['https://relay.groundworkokc.org'];
const LEGACY_RELAYS = new Set(['wss://relay.example.org', 'http://3.148.240.58']);
const RELAY_KIND_TO_LOCAL = {
  resource_pin: 'resource.pin.add',
  job_posted: 'job.posted',
  planting_request: 'planner.requested',
  dm: 'dm.sent',
};
const LOCAL_KIND_TO_RELAY = {
  'resource.pin.add': 'resource_pin',
  'job.posted': 'job_posted',
  'planner.requested': 'planting_request',
  'dm.sent': 'dm',
};
const TRUST_A = ['oak', 'cedar', 'elm', 'maple', 'sycamore', 'willow', 'juniper', 'birch'];
const TRUST_B = ['wren', 'heron', 'lark', 'fox', 'otter', 'bee', 'moth', 'hawk'];
const TRUST_C = ['12', '19', '27', '31', '41', '54', '67', '83'];
const SECTOR_COORDS = {
  'Paseo': [35.5224, -97.5261],
  'Plaza': [35.5135, -97.5485],
  'Midtown': [35.4731, -97.5178],
  'Downtown': [35.4676, -97.5164],
  'Innovation District': [35.4829, -97.5039],
  'Capitol Hill': [35.4331, -97.5207],
  'NE 23rd': [35.4932, -97.4701],
  'Southside': [35.4206, -97.5178],
};
const RESOURCE_ICONS = {
  water: '💧',
  restroom: '🚻',
  outlet: '🔌',
  shade: '🌳',
  tree: '🍎',
  garden: '🪴',
  fishing: '🎣',
};

const state = loadState();
let map = null;
let markersLayer = null;
let pendingLocation = null;
let pendingMarker = null;
let currentThread = null;

const routes = ['map', 'jobs', 'planner', 'groups', 'secure', 'inbox', 'relays', 'about'];
const tabEls = Array.from(document.querySelectorAll('.tab'));
const viewEls = routes.reduce((acc, route) => {
  acc[route] = document.getElementById(`view-${route}`);
  return acc;
}, {});

const resourceForm = document.getElementById('resourceForm');
const jobForm = document.getElementById('jobForm');
const plannerForm = document.getElementById('plannerForm');
const contactForm = document.getElementById('contactForm');
const messageForm = document.getElementById('messageForm');
const relayForm = document.getElementById('relayForm');
const importInput = document.getElementById('importInput');
const toast = document.getElementById('toast');

const resourceList = document.getElementById('resourceList');
const jobList = document.getElementById('jobList');
const plannerList = document.getElementById('plannerList');
const contactList = document.getElementById('contactList');
const threadList = document.getElementById('threadList');
const relayList = document.getElementById('relayList');
const identityCard = document.getElementById('identityCard');
const resourceSummary = document.getElementById('resourceSummary');
const jobSummary = document.getElementById('jobSummary');
const inboxSummary = document.getElementById('inboxSummary');
const eventShape = document.getElementById('eventShape');
const contactAliases = document.getElementById('contactAliases');

const resourcePreview = document.getElementById('resourcePreview');
const jobPreview = document.getElementById('jobPreview');
const resourceFilter = document.getElementById('resourceFilter');
const sectorFilter = document.getElementById('sectorFilter');
const scopeFilter = document.getElementById('scopeFilter');
const resourceScopeSelect = document.getElementById('resourceScopeSelect');
const seedDemoButton = document.getElementById('seedDemoButton');
const focusUserButton = document.getElementById('focusUserButton');
const pickMapLocationButton = document.getElementById('pickMapLocationButton');
const useLocationButton = document.getElementById('useLocationButton');
const clearLocationButton = document.getElementById('clearLocationButton');
const regenIdentityButton = document.getElementById('regenIdentityButton');
const copyTrustPhraseButton = document.getElementById('copyTrustPhraseButton');
const exportButton = document.getElementById('exportButton');
const createGroupForm = document.getElementById('createGroupForm');
const joinGroupForm = document.getElementById('joinGroupForm');
const groupList = document.getElementById('groupList');

wireRouting();
wireForms();
initMap();
render();
syncWithRelays();
setInterval(syncWithRelays, 60_000);

function loadState() {
  for (const key of STORAGE_KEYS) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      return normalizeState(parsed);
    } catch (error) {
      console.error(error);
    }
  }
  return normalizeState({});
}

function normalizeState(parsed) {
  return {
    version: 2,
    identity: parsed.identity || createIdentity(),
    contacts: Array.isArray(parsed.contacts) ? parsed.contacts : [],
    groups: Array.isArray(parsed.groups) ? parsed.groups : [],
    relays: normalizeRelays(parsed.relays),
    events: Array.isArray(parsed.events) ? parsed.events : [],
  };
}

function normalizeRelays(relays) {
  const source = Array.isArray(relays) && relays.length ? relays : DEFAULT_RELAYS;
  const normalized = source
    .map(url => String(url || '').trim())
    .filter(Boolean)
    .map(url => LEGACY_RELAYS.has(url) ? DEFAULT_RELAYS[0] : url);
  return Array.from(new Set(normalized));
}

function persist() {
  localStorage.setItem(ACTIVE_STORAGE_KEY, JSON.stringify(state));
}

function wireRouting() {
  window.addEventListener('hashchange', syncRouteFromHash);
  syncRouteFromHash();
}

function syncRouteFromHash() {
  const route = (window.location.hash || '#map').replace('#', '');
  const safeRoute = routes.includes(route) ? route : 'map';
  tabEls.forEach(tab => tab.classList.toggle('is-active', tab.dataset.route === safeRoute));
  Object.entries(viewEls).forEach(([name, el]) => el.classList.toggle('is-active', name === safeRoute));
  if (safeRoute === 'map' && map) {
    setTimeout(() => map.invalidateSize(), 50);
  }
}

function wireForms() {
  resourceForm.addEventListener('submit', handleResourceSubmit);
  jobForm.addEventListener('submit', handleJobSubmit);
  plannerForm.addEventListener('submit', handlePlannerSubmit);
  contactForm.addEventListener('submit', handleContactSubmit);
  messageForm.addEventListener('submit', handleMessageSubmit);
  relayForm.addEventListener('submit', handleRelaySubmit);
  createGroupForm.addEventListener('submit', handleCreateGroup);
  joinGroupForm.addEventListener('submit', handleJoinGroup);
  importInput.addEventListener('change', handleImport);
  resourceFilter.addEventListener('change', () => {
    renderResources();
    renderMap();
  });
  sectorFilter.addEventListener('change', () => {
    renderResources();
    renderMap();
  });
  scopeFilter.addEventListener('change', () => {
    renderResources();
    renderMap();
  });

  groupList.addEventListener('click', event => {
    const copyBtn = event.target.closest('[data-copy-group]');
    if (copyBtn) {
      navigator.clipboard.writeText(copyBtn.dataset.copyGroup).then(
        () => toastMessage('Group ID copied.'),
        () => toastMessage('Clipboard unavailable.')
      );
      return;
    }
    const leaveBtn = event.target.closest('[data-leave-group]');
    if (leaveBtn) {
      state.groups = state.groups.filter(g => g.id !== leaveBtn.dataset.leaveGroup);
      persist();
      renderGroups();
      populateScopeDropdowns();
      renderResources();
      renderMap();
      toastMessage('Left group.');
    }
  });

  regenIdentityButton.addEventListener('click', () => {
    state.identity = createIdentity();
    persist();
    renderIdentity();
    toastMessage('Local identity rotated.');
  });

  copyTrustPhraseButton.addEventListener('click', async () => {
    const phrase = state.identity.trustPhrase.join(' / ');
    try {
      await navigator.clipboard.writeText(phrase);
      toastMessage('Trust phrase copied.');
    } catch (error) {
      toastMessage('Clipboard unavailable.');
    }
  });

  exportButton.addEventListener('click', handleExport);
  seedDemoButton.addEventListener('click', seedDemoData);
  focusUserButton.addEventListener('click', focusUserLocation);
  useLocationButton.addEventListener('click', applyCurrentLocationToForm);
  pickMapLocationButton.addEventListener('click', () => {
    window.location.hash = '#map';
    toastMessage('Tap the map to set the resource location.');
  });
  clearLocationButton.addEventListener('click', clearPendingLocation);

  resourceForm.photo.addEventListener('change', async event => {
    const file = event.target.files[0];
    const dataUrl = file ? await readFileAsDataUrl(file) : '';
    resourcePreview.innerHTML = dataUrl ? `<img src="${dataUrl}" alt="Resource preview">` : '';
    resourcePreview.classList.toggle('hidden', !dataUrl);
    resourcePreview.dataset.photo = dataUrl;
  });

  jobForm.photo.addEventListener('change', async event => {
    const file = event.target.files[0];
    const dataUrl = file ? await readFileAsDataUrl(file) : '';
    jobPreview.innerHTML = dataUrl ? `<img src="${dataUrl}" alt="Job preview">` : '';
    jobPreview.classList.toggle('hidden', !dataUrl);
    jobPreview.dataset.photo = dataUrl;
  });

  relayList.addEventListener('click', event => {
    const button = event.target.closest('[data-remove-relay]');
    if (!button) return;
    state.relays = state.relays.filter(url => url !== button.dataset.removeRelay);
    persist();
    renderRelays();
  });

  threadList.addEventListener('click', event => {
    const focusButton = event.target.closest('[data-open-thread]');
    if (focusButton) {
      currentThread = focusButton.dataset.openThread;
      renderThreads();
      return;
    }
    const prefillButton = event.target.closest('[data-prefill-contact]');
    if (prefillButton) {
      messageForm.toAlias.value = prefillButton.dataset.prefillContact;
      window.location.hash = '#inbox';
      toastMessage('Contact copied into message form.');
    }
  });
}

function initMap() {
  if (!window.L) return;
  map = L.map('mapCanvas', { scrollWheelZoom: true }).setView([35.4676, -97.5164], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map);
  markersLayer = L.layerGroup().addTo(map);
  map.on('click', event => {
    pendingLocation = { lat: roundCoord(event.latlng.lat), lng: roundCoord(event.latlng.lng) };
    updatePendingLocationFields();
    renderPendingMarker();
    toastMessage('Resource location set from map.');
  });
}

function focusUserLocation() {
  if (!navigator.geolocation || !map) {
    toastMessage('Geolocation unavailable.');
    return;
  }
  navigator.geolocation.getCurrentPosition(position => {
    const lat = roundCoord(position.coords.latitude);
    const lng = roundCoord(position.coords.longitude);
    map.setView([lat, lng], 15);
    toastMessage('Map centered on your location.');
  }, () => toastMessage('Could not get your location.'), { enableHighAccuracy: true, timeout: 7000 });
}

function applyCurrentLocationToForm() {
  if (!navigator.geolocation) {
    toastMessage('Geolocation unavailable.');
    return;
  }
  navigator.geolocation.getCurrentPosition(position => {
    pendingLocation = { lat: roundCoord(position.coords.latitude), lng: roundCoord(position.coords.longitude) };
    updatePendingLocationFields();
    renderPendingMarker();
    if (map) map.setView([pendingLocation.lat, pendingLocation.lng], 15);
    toastMessage('Location added to the resource form.');
  }, () => toastMessage('Could not get your location.'), { enableHighAccuracy: true, timeout: 7000 });
}

function clearPendingLocation() {
  pendingLocation = null;
  resourceForm.lat.value = '';
  resourceForm.lng.value = '';
  if (pendingMarker && map) {
    map.removeLayer(pendingMarker);
    pendingMarker = null;
  }
}

function renderPendingMarker() {
  if (!map || !pendingLocation) return;
  if (pendingMarker) map.removeLayer(pendingMarker);
  pendingMarker = L.marker([pendingLocation.lat, pendingLocation.lng], { opacity: 0.85 }).addTo(map);
}

function updatePendingLocationFields() {
  resourceForm.lat.value = pendingLocation ? pendingLocation.lat : '';
  resourceForm.lng.value = pendingLocation ? pendingLocation.lng : '';
}

function createIdentity() {
  const seed = crypto.getRandomValues(new Uint8Array(8));
  const alias = `${capitalize(TRUST_A[seed[0] % TRUST_A.length])}${capitalize(TRUST_B[seed[1] % TRUST_B.length])}`;
  return {
    alias,
    deviceId: Array.from(seed).map(n => n.toString(16).padStart(2, '0')).join('').slice(0, 12),
    trustPhrase: buildTrustPhrase(seed),
    createdAt: new Date().toISOString(),
  };
}

function buildTrustPhrase(seed) {
  return [
    TRUST_A[seed[2] % TRUST_A.length],
    TRUST_B[seed[3] % TRUST_B.length],
    TRUST_C[seed[4] % TRUST_C.length],
  ];
}

function appendEvent(kind, payload) {
  const prev = state.events.length ? state.events[state.events.length - 1].id : null;
  const event = {
    id: crypto.randomUUID(),
    author: state.identity.deviceId,
    prev,
    kind,
    createdAt: new Date().toISOString(),
    payload,
  };
  state.events.push(event);
  persist();
  pushEventToRelays(event);
  return event;
}

async function syncWithRelays() {
  if (!state.relays.length) return;
  await pushEventsToRelays(state.events);
  const changed = await pullEventsFromRelays();
  if (changed) {
    persist();
    render();
  }
}

async function pushEventsToRelays(events) {
  const relayEvents = events.map(toRelayEvent).filter(Boolean);
  if (!relayEvents.length) return;
  for (const relayUrl of state.relays) {
    for (let index = 0; index < relayEvents.length; index += 100) {
      await postRelayBatch(relayUrl, relayEvents.slice(index, index + 100));
    }
  }
}

async function pushEventToRelays(event) {
  const relayEvent = toRelayEvent(event);
  if (!relayEvent) return;
  for (const relayUrl of state.relays) {
    postRelayBatch(relayUrl, [relayEvent]);
  }
}

async function postRelayBatch(relayUrl, batch) {
  if (!batch.length) return;
  try {
    const response = await fetch(`${cleanRelayUrl(relayUrl)}/v1/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(batch.length === 1 ? batch[0] : batch),
    });
    if (!response.ok) throw new Error(`Relay write failed: ${response.status}`);
  } catch (error) {
    console.warn(error);
  }
}

async function pullEventsFromRelays() {
  let changed = false;
  for (const relayUrl of state.relays) {
    const queries = [
      `${cleanRelayUrl(relayUrl)}/v1/events?limit=500`,
      ...state.groups.map(group => `${cleanRelayUrl(relayUrl)}/v1/events?limit=500&includePrivate=true&recipient=${encodeURIComponent(group.id)}`),
      `${cleanRelayUrl(relayUrl)}/v1/inbox/${encodeURIComponent(state.identity.alias)}?limit=500`,
    ];
    for (const url of queries) {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Relay read failed: ${response.status}`);
        const data = await response.json();
        if (!Array.isArray(data.events)) continue;
        data.events.forEach(relayEvent => {
          const localEvent = fromRelayEvent(relayEvent);
          if (!localEvent || state.events.some(event => event.id === localEvent.id)) return;
          state.events.push(localEvent);
          changed = true;
        });
      } catch (error) {
        console.warn(error);
      }
    }
  }
  if (changed) {
    state.events.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }
  return changed;
}

function toRelayEvent(event) {
  const kind = LOCAL_KIND_TO_RELAY[event.kind];
  if (!kind) return null;
  const body = { ...event.payload, localKind: event.kind };
  const relayEvent = {
    id: event.id,
    kind,
    author: event.author,
    createdAt: Date.parse(event.createdAt) || Date.now(),
    scope: 'public',
    tile: event.payload.sector ? `okc:sector:${event.payload.sector}` : '',
    body,
  };

  if (event.kind === 'resource.pin.add' && event.payload.groupId) {
    relayEvent.scope = 'private';
    relayEvent.recipient = event.payload.groupId;
  }
  if (event.kind === 'dm.sent') {
    relayEvent.scope = 'private';
    relayEvent.recipient = event.payload.toAlias;
  }
  return relayEvent;
}

function fromRelayEvent(relayEvent) {
  const kind = RELAY_KIND_TO_LOCAL[relayEvent.kind];
  if (!kind || !relayEvent.body) return null;
  const payload = { ...relayEvent.body };
  delete payload.localKind;
  if (kind === 'resource.pin.add' && relayEvent.scope === 'private' && relayEvent.recipient && !payload.groupId) {
    payload.groupId = relayEvent.recipient;
  }
  return {
    id: relayEvent.id,
    author: relayEvent.author,
    prev: null,
    kind,
    createdAt: new Date(relayEvent.createdAt).toISOString(),
    payload,
  };
}

function cleanRelayUrl(url) {
  return String(url || '').replace(/\/+$/, '');
}

function deriveResources() {
  return state.events
    .filter(event => event.kind === 'resource.pin.add')
    .map(event => ({ ...event.payload, id: event.id, createdAt: event.createdAt }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function deriveJobs() {
  return state.events
    .filter(event => event.kind === 'job.posted')
    .map(event => ({ ...event.payload, id: event.id, createdAt: event.createdAt }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function derivePlans() {
  return state.events
    .filter(event => event.kind === 'planner.requested')
    .map(event => ({ ...event.payload, id: event.id, createdAt: event.createdAt }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function deriveMessages() {
  return state.events
    .filter(event => event.kind === 'dm.sent')
    .map(event => ({ ...event.payload, id: event.id, createdAt: event.createdAt }))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

function render() {
  populateScopeDropdowns();
  renderResources();
  renderMap();
  renderJobs();
  renderPlans();
  renderIdentity();
  renderContacts();
  renderThreads();
  renderRelays();
  renderGroups();
  renderEventShape();
}

function getFilteredResources() {
  const allResources = deriveResources();
  const typeValue = resourceFilter.value;
  const sectorValue = sectorFilter.value;
  const scopeValue = scopeFilter.value;

  return allResources.filter(item => {
    // Determine the scope of this item: if it has a groupId, it's group-scoped. Otherwise public.
    const itemScope = item.groupId ? item.groupId : 'public';
    
    // 1. Check scope match
    let scopeOk = false;
    if (scopeValue === 'public') {
      scopeOk = (itemScope === 'public');
    } else {
      // It's a specific group. We only show pins for that specific group.
      scopeOk = (itemScope === scopeValue);
    }

    // 2. Check type match
    const typeOk = typeValue === 'all' || item.resource === typeValue;
    
    // 3. Check sector match
    const sectorOk = sectorValue === 'all' || item.sector === sectorValue;

    return scopeOk && typeOk && sectorOk;
  });
}

function renderResources() {
  const allResources = deriveResources();
  const resources = getFilteredResources();
  const totals = countBy(resources, item => item.resource);
  resourceSummary.innerHTML = [
    `<span class="stat"><strong>${resources.length}</strong> pins in view</span>`,
    `<span class="stat"><strong>${totals.water || 0}</strong> water</span>`,
    `<span class="stat"><strong>${totals.restroom || 0}</strong> restrooms</span>`,
    `<span class="stat"><strong>${totals.fishing || 0}</strong> fishing</span>`,
    `<span class="stat"><strong>${totals.shade || 0}</strong> shade</span>`,
  ].join('');

  if (!resources.length) {
    resourceList.innerHTML = '<div class="empty">No pins yet for this filter. Add the first one.</div>';
    return;
  }

  resourceList.innerHTML = resources.map(item => renderResourceCard(item)).join('');
}

function renderMap() {
  if (!map || !markersLayer) return;
  markersLayer.clearLayers();
  const resources = getFilteredResources();
  if (!resources.length) return;
  const bounds = [];
  resources.forEach(item => {
    const [lat, lng] = resolveCoords(item);
    bounds.push([lat, lng]);
    const marker = L.marker([lat, lng]).addTo(markersLayer);
    marker.bindPopup(`<strong>${escapeHtml(RESOURCE_ICONS[item.resource] || '📍')} ${escapeHtml(item.note)}</strong><br>${escapeHtml(item.sector)} · ${escapeHtml(item.access)}<br><small>by ${escapeHtml(item.alias)}</small>`);
  });
  if (bounds.length === 1) {
    map.setView(bounds[0], 14);
  } else {
    map.fitBounds(bounds, { padding: [30, 30] });
  }
  renderPendingMarker();
}

function resolveCoords(item) {
  if (Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng))) {
    return [Number(item.lat), Number(item.lng)];
  }
  const center = SECTOR_COORDS[item.sector] || [35.4676, -97.5164];
  return [center[0], center[1]];
}

function renderJobs() {
  const jobs = deriveJobs();
  const totals = countBy(jobs, item => item.service);
  jobSummary.innerHTML = [
    `<span class="stat"><strong>${jobs.length}</strong> open jobs</span>`,
    `<span class="stat"><strong>${totals['watering'] || 0}</strong> watering</span>`,
    `<span class="stat"><strong>${totals['garden cleanup'] || 0}</strong> cleanup</span>`,
  ].join('');

  if (!jobs.length) {
    jobList.innerHTML = '<div class="empty">No jobs yet. Post one sentence, a price, and optionally a photo.</div>';
    return;
  }

  jobList.innerHTML = jobs.map(item => renderJobCard(item)).join('');
}

function renderPlans() {
  const plans = derivePlans();
  if (!plans.length) {
    plannerList.innerHTML = '<div class="empty">No plans yet. Generate one from the planner form.</div>';
    return;
  }
  plannerList.innerHTML = plans.map(item => renderPlanCard(item)).join('');
}

function renderIdentity() {
  const phrase = state.identity.trustPhrase.map(part => `<span class="trust-pill">${escapeHtml(part)}</span>`).join('');
  identityCard.innerHTML = `
    <h3>${escapeHtml(state.identity.alias)}</h3>
    <p class="card-subtitle">Device ${escapeHtml(state.identity.deviceId)} · local-only for now</p>
    <div class="trust-phrase">${phrase}</div>
    <p class="card-subtitle">Use this phrase to verify you are talking to the same person and device.</p>
    <div class="qr-grid">${buildQrCells(state.identity.deviceId)}</div>
  `;
}

function renderContacts() {
  contactAliases.innerHTML = state.contacts.map(contact => `<option value="${escapeAttribute(contact.alias)}"></option>`).join('');
  if (!state.contacts.length) {
    contactList.innerHTML = '<div class="empty">No verified contacts yet.</div>';
    return;
  }

  contactList.innerHTML = state.contacts.slice().reverse().map(contact => `
      <article class="card">
        <div class="card-head">
          <div>
            <h3 class="card-title">${escapeHtml(contact.alias)}</h3>
            <p class="card-subtitle">Trust phrase recorded locally</p>
          </div>
          <span class="access-chip">verified</span>
        </div>
        <div class="card-meta"><span>${escapeHtml(contact.phrase)}</span></div>
      </article>
    `).join('');
}

function renderThreads() {
  const messages = deriveMessages();
  const grouped = new Map();
  messages.forEach(message => {
    const key = message.toAlias;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(message);
  });

  inboxSummary.innerHTML = [
    `<span class="stat"><strong>${messages.length}</strong> queued messages</span>`,
    `<span class="stat"><strong>${grouped.size}</strong> threads</span>`,
    `<span class="stat"><strong>${state.relays.length}</strong> relays configured</span>`,
  ].join('');

  if (!grouped.size) {
    threadList.innerHTML = '<div class="empty">No local messages yet. Queue one here, then sync later through a relay.</div>';
    return;
  }

  const entries = Array.from(grouped.entries()).sort((a, b) => new Date(b[1][b[1].length - 1].createdAt) - new Date(a[1][a[1].length - 1].createdAt));
  if (!currentThread) currentThread = entries[0][0];

  threadList.innerHTML = entries.map(([alias, msgs]) => {
    const latest = msgs[msgs.length - 1];
    const isOpen = currentThread === alias;
    return `
      <article class="card">
        <div class="card-head">
          <div>
            <h3 class="card-title">${escapeHtml(alias)}</h3>
            <p class="card-subtitle">${escapeHtml(latest.topic)} · ${formatDate(latest.createdAt)}</p>
          </div>
          <button class="button small" type="button" data-open-thread="${escapeAttribute(alias)}">${isOpen ? 'Open' : 'View'}</button>
        </div>
        ${isOpen ? renderThreadBody(msgs) : `<p class="card-subtitle">${escapeHtml(latest.body)}</p>`}
      </article>
    `;
  }).join('');
}

function renderThreadBody(messages) {
  return `
    <div class="message-stack">
      ${messages.map(message => `
        <div class="message-bubble outgoing">
          <div class="message-meta">
            <span>${escapeHtml(message.topic)}</span>
            <span>${formatDate(message.createdAt)}</span>
          </div>
          <p>${escapeHtml(message.body)}</p>
          <div class="message-actions">
            <span class="badge">relay-ready</span>
            <button class="button small" type="button" data-prefill-contact="${escapeAttribute(message.toAlias)}">Reply</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderRelays() {
  if (!state.relays.length) {
    relayList.innerHTML = '<div class="empty">No relays configured yet.</div>';
    return;
  }

  relayList.innerHTML = state.relays.map(url => `
      <article class="card">
        <div class="card-head">
          <div>
            <h3 class="card-title">${escapeHtml(url)}</h3>
            <p class="card-subtitle">Stored locally for later sync</p>
          </div>
          <button class="button small" type="button" data-remove-relay="${escapeAttribute(url)}">Remove</button>
        </div>
      </article>
    `).join('');
}

function renderEventShape() {
  eventShape.textContent = JSON.stringify({
    id: 'uuid',
    author: 'device-id',
    prev: 'previous-event-id-or-null',
    kind: 'resource.pin.add | job.posted | planner.requested | dm.sent',
    createdAt: 'ISO timestamp',
    payload: {
      resource: 'water | outlet | shade | tree | garden',
      service: 'job type',
      topic: 'message topic',
      sector: 'Paseo',
      lat: 35.4676,
      lng: -97.5164,
      note: 'one sentence',
      photo: 'optional data URL',
    },
  }, null, 2);
}

async function handleResourceSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const fd = new FormData(form);
  const note = String(fd.get('note') || '').trim();
  if (!note) {
    toastMessage('Add one sentence for the pin.');
    return;
  }

  const sector = String(fd.get('sector'));
  const lat = Number(fd.get('lat'));
  const lng = Number(fd.get('lng'));
  const coords = Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : SECTOR_COORDS[sector] || [35.4676, -97.5164];

  const scopeValue = fd.get('scope') || 'public';
  const groupId = scopeValue === 'public' ? null : scopeValue;

  appendEvent('resource.pin.add', {
    resource: fd.get('resource'),
    sector,
    access: fd.get('access'),
    note,
    lat: coords[0],
    lng: coords[1],
    photo: resourcePreview.dataset.photo || '',
    alias: state.identity.alias,
    groupId: groupId,
  });

  form.reset();
  clearPendingLocation();
  resourcePreview.dataset.photo = '';
  resourcePreview.innerHTML = '';
  resourcePreview.classList.add('hidden');
  renderResources();
  renderMap();
  toastMessage('Pin posted locally.');
}

function handleCreateGroup(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const fd = new FormData(form);
  const groupName = String(fd.get('groupName') || '').trim();
  if (!groupName) return;

  const groupId = crypto.randomUUID();
  state.groups.push({ id: groupId, name: groupName });
  persist();
  form.reset();
  renderGroups();
  populateScopeDropdowns();
  toastMessage('Group created locally.');
}

function handleJoinGroup(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const fd = new FormData(form);
  const groupId = String(fd.get('groupId') || '').trim();
  if (!groupId) return;

  if (state.groups.find(g => g.id === groupId)) {
    toastMessage('Already in this group.');
    return;
  }
  
  // Provide a default name since we just have the ID. 
  // In a real app with sync, you'd fetch the name.
  state.groups.push({ id: groupId, name: `Joined Group (${groupId.slice(0, 4)})` });
  persist();
  form.reset();
  renderGroups();
  populateScopeDropdowns();
  renderResources();
  renderMap();
  toastMessage('Group joined locally.');
}

function renderGroups() {
  if (!state.groups.length) {
    groupList.innerHTML = `<div class="empty">You haven't joined any groups yet.</div>`;
    return;
  }

  groupList.innerHTML = state.groups.map(group => `
    <article class="card">
      <div class="card-head">
        <div>
          <h3 class="card-title">${escapeHtml(group.name)}</h3>
          <p class="card-subtitle">ID: ${escapeHtml(group.id)}</p>
        </div>
        <div class="inline-actions wrap">
          <button class="button small" type="button" data-copy-group="${escapeAttribute(group.id)}">Copy ID</button>
          <button class="button small" type="button" data-leave-group="${escapeAttribute(group.id)}">Leave</button>
        </div>
      </div>
    </article>
  `).join('');
}

function populateScopeDropdowns() {
  const publicOption = '<option value="public">Public map</option>';
  const groupOptions = state.groups.map(g => `<option value="${escapeAttribute(g.id)}">Group: ${escapeHtml(g.name)}</option>`).join('');
  const allOptions = publicOption + groupOptions;
  
  // Only update if options changed (simple check based on length, though innerHTML assignment is cheap)
  resourceScopeSelect.innerHTML = allOptions;
  scopeFilter.innerHTML = allOptions;
}

async function handleJobSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const fd = new FormData(form);
  const sentence = String(fd.get('sentence') || '').trim();
  const price = Number(fd.get('price'));
  if (!sentence || Number.isNaN(price)) {
    toastMessage('Add a sentence and a price.');
    return;
  }
  appendEvent('job.posted', {
    service: fd.get('service'),
    sector: fd.get('sector'),
    sentence,
    price,
    photo: jobPreview.dataset.photo || '',
    alias: state.identity.alias,
  });
  form.reset();
  jobPreview.dataset.photo = '';
  jobPreview.innerHTML = '';
  jobPreview.classList.add('hidden');
  renderJobs();
  toastMessage('Job posted locally.');
}

function handlePlannerSubmit(event) {
  event.preventDefault();
  const fd = new FormData(event.currentTarget);
  const payload = {
    projectType: String(fd.get('projectType') || ''),
    species: String(fd.get('species') || '').trim(),
    sun: String(fd.get('sun') || ''),
    waterAccess: String(fd.get('waterAccess') || ''),
    soil: String(fd.get('soil') || ''),
    month: String(fd.get('month') || ''),
    goal: String(fd.get('goal') || '').trim(),
    request: String(fd.get('request') || '').trim(),
    alias: state.identity.alias,
  };
  if (!payload.species || !payload.goal || !payload.request) {
    toastMessage('Fill the planner request first.');
    return;
  }
  const generated = generatePlan(payload);
  appendEvent('planner.requested', { ...payload, ...generated });
  event.currentTarget.reset();
  renderPlans();
  toastMessage('Plan generated locally.');
}

function generatePlan(payload) {
  const principles = [
    'Observe and interact: watch sun, wind, runoff, and foot traffic for one week before planting.',
    'Catch and store energy: mulch immediately and shape the basin so rain stays on site.',
    'Small and slow solutions: start with one bed or one tree guild before scaling.',
    'Stack functions: choose species that feed pollinators, cool the street, and improve soil.',
  ];

  const actions = [];
  actions.push(`Start in ${payload.month} with a small pilot around ${payload.species}.`);
  if (payload.waterAccess === 'haul by hand') {
    actions.push('Favor drought-tolerant companions, thicker mulch, and a watering ring to reduce labor.');
  } else if (payload.waterAccess === 'limited') {
    actions.push('Use basins, wood chips, and dense groundcover so each watering lasts longer.');
  } else {
    actions.push('Set a deep, infrequent watering rhythm instead of shallow daily watering.');
  }

  if (payload.soil === 'clay' || payload.soil === 'compacted urban') {
    actions.push('Loosen only the planting pocket, top-dress with compost, and mulch wide rather than tilling the whole site.');
  } else if (payload.soil === 'sandy') {
    actions.push('Add compost and mulch to hold moisture, then plant support species to shade the soil.');
  } else {
    actions.push('Keep disturbance low and build fertility with mulch, compost, and living roots.');
  }

  if (payload.projectType === 'fruit tree guild') {
    actions.push('Place insectary flowers on the sunny edge, mulch ring outside the trunk flare, and low groundcovers beyond that.');
  }
  if (payload.projectType === 'rain garden') {
    actions.push('Confirm overflow path first, then group plants by moisture tolerance from center to edge.');
  }
  if (payload.projectType === 'native pollinator bed') {
    actions.push('Mix bloom times so something flowers in early, mid, and late season.');
  }

  const timeline = [
    `Week 1: observe the site, mark sun and runoff, and gather mulch for ${payload.species}.`,
    'Week 2: prepare a small basin or bed, add compost only where needed, and protect bare soil with mulch.',
    'Week 3: plant the anchor species, then add one or two companion species that serve pollinators or soil cover.',
    'Week 4+: water deeply, note stress signs, and adjust slowly instead of redesigning everything at once.',
  ];

  return { principles, actions, timeline };
}

function handleContactSubmit(event) {
  event.preventDefault();
  const fd = new FormData(event.currentTarget);
  const alias = String(fd.get('alias') || '').trim();
  const phrase = String(fd.get('phrase') || '').trim();
  if (!alias || !phrase) {
    toastMessage('Add both alias and trust phrase.');
    return;
  }
  state.contacts.push({ alias, phrase, savedAt: new Date().toISOString() });
  persist();
  event.currentTarget.reset();
  renderContacts();
  toastMessage('Contact saved locally.');
}

function handleMessageSubmit(event) {
  event.preventDefault();
  const fd = new FormData(event.currentTarget);
  const toAlias = String(fd.get('toAlias') || '').trim();
  const body = String(fd.get('body') || '').trim();
  const topic = String(fd.get('topic') || '').trim();
  if (!toAlias || !body) {
    toastMessage('Add a contact alias and a message.');
    return;
  }
  appendEvent('dm.sent', {
    toAlias,
    body,
    topic,
    alias: state.identity.alias,
    status: 'relay-ready',
  });
  currentThread = toAlias;
  event.currentTarget.reset();
  renderThreads();
  toastMessage('Message queued locally.');
}

function handleRelaySubmit(event) {
  event.preventDefault();
  const fd = new FormData(event.currentTarget);
  const url = String(fd.get('url') || '').trim();
  if (!url) {
    toastMessage('Add a relay URL.');
    return;
  }
  if (state.relays.includes(url)) {
    toastMessage('Relay already added.');
    return;
  }
  state.relays.push(url);
  persist();
  event.currentTarget.reset();
  renderRelays();
  renderThreads();
  toastMessage('Relay saved locally.');
}

function handleExport() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'groundwork-okc-export.json';
  a.click();
  URL.revokeObjectURL(url);
  toastMessage('Export ready.');
}

async function handleImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed.events)) throw new Error('Invalid export');
    const normalized = normalizeState(parsed);
    state.identity = normalized.identity;
    state.contacts = normalized.contacts;
    state.relays = normalized.relays;
    state.events = normalized.events;
    persist();
    render();
    toastMessage('Import complete.');
  } catch (error) {
    console.error(error);
    toastMessage('Import failed.');
  } finally {
    event.target.value = '';
  }
}

function renderResourceCard(item) {
  return `
    <article class="card">
      <div class="card-head">
        <div>
          <div class="card-meta">
            <span class="resource-chip">${escapeHtml(item.resource)}</span>
            <span class="access-chip">${escapeHtml(item.access)}</span>
          </div>
          <h3 class="card-title">${escapeHtml(item.note)}</h3>
          <p class="card-subtitle">${escapeHtml(item.sector)} · posted by ${escapeHtml(item.alias)}</p>
        </div>
        <span class="badge">${formatDate(item.createdAt)}</span>
      </div>
      <div class="card-meta">
        <span>${escapeHtml(String(roundCoord(item.lat)))} , ${escapeHtml(String(roundCoord(item.lng)))}</span>
      </div>
      ${item.photo ? `<img src="${item.photo}" alt="Pin photo">` : ''}
    </article>
  `;
}

function renderJobCard(item) {
  return `
    <article class="card">
      <div class="card-head">
        <div>
          <div class="card-meta">
            <span class="service-chip">${escapeHtml(item.service)}</span>
            <span class="badge">${escapeHtml(item.sector)}</span>
          </div>
          <h3 class="card-title">${escapeHtml(item.sentence)}</h3>
          <p class="card-subtitle">Posted by ${escapeHtml(item.alias)}</p>
        </div>
        <span class="resource-chip">$${escapeHtml(String(item.price))}</span>
      </div>
      ${item.photo ? `<img src="${item.photo}" alt="Job photo">` : ''}
    </article>
  `;
}

function renderPlanCard(item) {
  return `
    <article class="card">
      <div class="card-head">
        <div>
          <div class="card-meta">
            <span class="service-chip">${escapeHtml(item.projectType)}</span>
            <span class="badge">${escapeHtml(item.month)}</span>
          </div>
          <h3 class="card-title">${escapeHtml(item.request)}</h3>
          <p class="card-subtitle">${escapeHtml(item.species)} · ${escapeHtml(item.goal)}</p>
        </div>
      </div>
      <div class="stack compact">
        <div>
          <strong>Permaculture principles</strong>
          <ul class="mini-list">${item.principles.map(line => `<li>${escapeHtml(line)}</li>`).join('')}</ul>
        </div>
        <div>
          <strong>Suggested actions</strong>
          <ul class="mini-list">${item.actions.map(line => `<li>${escapeHtml(line)}</li>`).join('')}</ul>
        </div>
        <div>
          <strong>Timeline</strong>
          <ul class="mini-list">${item.timeline.map(line => `<li>${escapeHtml(line)}</li>`).join('')}</ul>
        </div>
      </div>
    </article>
  `;
}

function seedDemoData() {
  if (state.events.length) {
    toastMessage('Skipped: your log already has entries. Clear local storage first.');
    return;
  }
  
  const libraries = [
    { name: 'Southwest Oklahoma City Public Library', lat: 35.3347, lng: -97.5498, sector: 'Southside' },
    { name: 'Robert M. Bird Library', lat: 35.4795, lng: -97.4942, sector: 'Innovation District' },
    { name: 'Belle Isle Library', lat: 35.5256, lng: -97.5570, sector: 'Plaza' },
    { name: 'Keith Leftwich Memorial Library', lat: 35.3889, lng: -97.5691, sector: 'Southside' },
    { name: 'Ronald J. Norick Downtown Library', lat: 35.4685, lng: -97.5186, sector: 'Downtown' },
    { name: 'Patience S. Latting Northwest Library', lat: 35.5940, lng: -97.6180, sector: 'Paseo' },
    { name: 'Almonte Metropolitan Library', lat: 35.4040, lng: -97.5664, sector: 'Southside' }
  ];

  libraries.forEach(lib => {
    appendEvent('resource.pin.add', {
      resource: 'water', 
      sector: lib.sector, 
      access: 'public', 
      note: `Waterfountain and restroom - ${lib.name}`, 
      lat: lib.lat, 
      lng: lib.lng, 
      photo: '', 
      alias: state.identity.alias,
      groupId: null
    });
  });

  appendEvent('job.posted', {
    service: 'watering', sector: 'Downtown', sentence: 'Need two tree wells watered near the main library.', price: 25, photo: '', alias: state.identity.alias,
  });

  render();
  toastMessage('OKC libraries loaded.');
}

function buildQrCells(seed) {
  const chars = seed.split('');
  let html = '';
  for (let i = 0; i < 25; i += 1) {
    const char = chars[i % chars.length];
    const on = (char.charCodeAt(0) + i) % 2 === 0;
    html += `<span class="qr-cell${on ? ' on' : ''}"></span>`;
  }
  return html;
}

function countBy(list, pick) {
  return list.reduce((acc, item) => {
    const key = pick(item);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function toastMessage(message) {
  toast.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.add('hidden'), 1800);
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function roundCoord(value) {
  return Math.round(Number(value) * 100000) / 100000;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
