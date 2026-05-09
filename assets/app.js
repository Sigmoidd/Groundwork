
const STORAGE_KEYS = ['groundwork-okc-v2', 'groundwork-okc-v1'];
const ACTIVE_STORAGE_KEY = 'groundwork-okc-v2';
const DEFAULT_RELAYS = ['https://relay.groundworkokc.org'];
const LEGACY_RELAYS = new Set(['wss://relay.example.org', 'http://3.148.240.58']);

const RELAY_KIND_TO_LOCAL = {
  resource_pin: 'resource.pin.add',
  resource_pin_confirmed: 'resource.pin.confirmed',
  resource_pin_rated: 'resource.pin.rated',
  resource_pin_noted: 'resource.pin.noted',
  resource_pin_photo_added: 'resource.pin.photo.added',
  job_posted: 'job.posted',
  planting_request: 'planner.requested',
  dm: 'dm.sent',
};

const LOCAL_KIND_TO_RELAY = {
  'resource.pin.add': 'resource_pin',
  'resource.pin.confirmed': 'resource_pin_confirmed',
  'resource.pin.rated': 'resource_pin_rated',
  'resource.pin.noted': 'resource_pin_noted',
  'resource.pin.photo.added': 'resource_pin_photo_added',
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
      return normalizeState(JSON.parse(raw));
    } catch (error) {
      console.error(error);
    }
  }
  return normalizeState({});
}

function normalizeState(parsed) {
  return {
    version: 3,
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
  resourceForm?.addEventListener('submit', handleResourceSubmit);
  jobForm?.addEventListener('submit', handleJobSubmit);
  plannerForm?.addEventListener('submit', handlePlannerSubmit);
  contactForm?.addEventListener('submit', handleContactSubmit);
  messageForm?.addEventListener('submit', handleMessageSubmit);
  relayForm?.addEventListener('submit', handleRelaySubmit);
  createGroupForm?.addEventListener('submit', handleCreateGroup);
  joinGroupForm?.addEventListener('submit', handleJoinGroup);
  importInput?.addEventListener('change', handleImport);

  resourceFilter?.addEventListener('change', () => {
    renderResources();
    renderMap();
  });

  sectorFilter?.addEventListener('change', () => {
    renderResources();
    renderMap();
  });

  scopeFilter?.addEventListener('change', () => {
    renderResources();
    renderMap();
  });

  const resourcePhotoInput = resourceForm?.querySelector('input[name="photo"]');
  resourcePhotoInput?.addEventListener('change', async event => {
    const file = event.target.files?.[0];
    const dataUrl = file ? await readFileAsDataUrl(file) : '';
    resourcePreview.innerHTML = dataUrl ? `<img src="${escapeAttribute(dataUrl)}" alt="Resource preview">` : '';
    resourcePreview.classList.toggle('hidden', !dataUrl);
    resourcePreview.dataset.photo = dataUrl;
  });

  const jobPhotoInput = jobForm?.querySelector('input[name="photo"]');
  jobPhotoInput?.addEventListener('change', async event => {
    const file = event.target.files?.[0];
    const dataUrl = file ? await readFileAsDataUrl(file) : '';
    jobPreview.innerHTML = dataUrl ? `<img src="${escapeAttribute(dataUrl)}" alt="Job preview">` : '';
    jobPreview.classList.toggle('hidden', !dataUrl);
    jobPreview.dataset.photo = dataUrl;
  });

  groupList?.addEventListener('click', event => {
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
      state.groups = state.groups.filter(group => group.id !== leaveBtn.dataset.leaveGroup);
      persist();
      populateScopeDropdowns();
      render();
      toastMessage('Left group.');
    }
  });

  regenIdentityButton?.addEventListener('click', () => {
    state.identity = createIdentity();
    persist();
    renderIdentity();
    toastMessage('Local identity rotated.');
  });

  copyTrustPhraseButton?.addEventListener('click', async () => {
    const phrase = state.identity.trustPhrase.join(' / ');
    try {
      await navigator.clipboard.writeText(phrase);
      toastMessage('Trust phrase copied.');
    } catch (error) {
      toastMessage('Clipboard unavailable.');
    }
  });

  exportButton?.addEventListener('click', handleExport);
  seedDemoButton?.addEventListener('click', seedDemoData);
  focusUserButton?.addEventListener('click', focusUserLocation);
  useLocationButton?.addEventListener('click', applyCurrentLocationToForm);
  pickMapLocationButton?.addEventListener('click', () => {
    window.location.hash = '#map';
    toastMessage('Tap the map to set the resource location.');
  });
  clearLocationButton?.addEventListener('click', clearPendingLocation);

  relayList?.addEventListener('click', event => {
    const button = event.target.closest('[data-remove-relay]');
    if (!button) return;
    state.relays = state.relays.filter(url => url !== button.dataset.removeRelay);
    persist();
    renderRelays();
    toastMessage('Relay removed.');
  });

  threadList?.addEventListener('click', event => {
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

  resourceList?.addEventListener('click', handleResourceCardClick);
  resourceList?.addEventListener('change', handleResourceCardChange);
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
    pendingLocation = {
      lat: roundCoord(event.latlng.lat),
      lng: roundCoord(event.latlng.lng),
    };
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
  }, () => toastMessage('Could not get your location.'), {
    enableHighAccuracy: true,
    timeout: 7000,
  });
}

function applyCurrentLocationToForm() {
  if (!navigator.geolocation) {
    toastMessage('Geolocation unavailable.');
    return;
  }

  navigator.geolocation.getCurrentPosition(position => {
    pendingLocation = {
      lat: roundCoord(position.coords.latitude),
      lng: roundCoord(position.coords.longitude),
    };
    updatePendingLocationFields();
    renderPendingMarker();
    if (map) map.setView([pendingLocation.lat, pendingLocation.lng], 15);
    toastMessage('Location added to the resource form.');
  }, () => toastMessage('Could not get your location.'), {
    enableHighAccuracy: true,
    timeout: 7000,
  });
}

function clearPendingLocation() {
  pendingLocation = null;
  if (resourceForm) {
    resourceForm.lat.value = '';
    resourceForm.lng.value = '';
  }

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
  if (!resourceForm) return;
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
    tile: event.payload?.sector ? `okc:sector:${event.payload.sector}` : '',
    body,
  };

  const resourceScope = getResourceScopeForEvent(event);

  if (resourceScope?.groupId) {
    relayEvent.scope = 'private';
    relayEvent.recipient = resourceScope.groupId;
  }

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

function getResourceScopeForEvent(event) {
  const resourceId = event.payload?.resourceId;
  if (!resourceId) return null;

  const resource = deriveResources().find(item => item.id === resourceId);
  if (!resource) return null;

  return { groupId: resource.groupId || null };
}

function cleanRelayUrl(url) {
  return String(url || '').replace(/\/+$/, '');
}

function deriveResources() {
  const resources = state.events
    .filter(event => event.kind === 'resource.pin.add')
    .map(event => normalizeResourceRecord({
      ...event.payload,
      id: event.id,
      createdAt: event.createdAt,
    }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const byId = new Map(resources.map(resource => [resource.id, resource]));

  state.events.forEach(event => {
    const payload = event.payload || {};
    const resourceId = payload.resourceId;
    if (!resourceId) return;

    const resource = byId.get(resourceId);
    if (!resource) return;

    switch (event.kind) {
      case 'resource.pin.confirmed':
        resource.confirmations.push({
          alias: payload.alias || 'Local user',
          at: event.createdAt,
        });
        resource.lastVerifiedAt = maxIsoTimestamp(resource.lastVerifiedAt, event.createdAt);
        break;

      case 'resource.pin.rated': {
        const score = Number(payload.score);
        if (!Number.isFinite(score)) break;
        resource.ratings.push({
          alias: payload.alias || 'Local user',
          score,
          at: event.createdAt,
        });
        break;
      }

      case 'resource.pin.noted': {
        const body = String(payload.body || '').trim();
        if (!body) break;
        resource.comments.push({
          alias: payload.alias || 'Local user',
          body,
          at: event.createdAt,
        });
        break;
      }

      case 'resource.pin.photo.added': {
        const photo = String(payload.photo || '').trim();
        if (!photo) break;
        resource.photos.push({
          alias: payload.alias || 'Local user',
          src: photo,
          at: event.createdAt,
        });
        resource.lastVerifiedAt = maxIsoTimestamp(resource.lastVerifiedAt, event.createdAt);
        break;
      }

      default:
        break;
    }
  });

  return Array.from(byId.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
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
    .map(event => ({ ...event.payload, id: event.id, createdAt: event.createdAt, author: event.author }))
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

function populateScopeDropdowns() {
  const groupOptions = state.groups
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(group => `<option value="${escapeAttribute(group.id)}">${escapeHtml(group.name)}</option>`)
    .join('');

  if (resourceScopeSelect) {
    resourceScopeSelect.innerHTML = `<option value="public">Public map</option>${groupOptions}`;
  }

  if (scopeFilter) {
    const current = scopeFilter.value || 'public';
    scopeFilter.innerHTML = `<option value="public">Public map</option>${groupOptions}`;
    scopeFilter.value = Array.from(scopeFilter.options).some(option => option.value === current) ? current : 'public';
  }
}

function getFilteredResources() {
  const resources = deriveResources();
  const typeValue = resourceFilter?.value || 'all';
  const sectorValue = sectorFilter?.value || 'all';
  const scopeValue = scopeFilter?.value || 'public';

  return resources.filter(item => {
    const itemScope = item.groupId ? item.groupId : 'public';
    const scopeOk = scopeValue === 'public' ? itemScope === 'public' : itemScope === scopeValue;
    const typeOk = typeValue === 'all' || item.resource === typeValue;
    const sectorOk = sectorValue === 'all' || item.sector === sectorValue;
    return scopeOk && typeOk && sectorOk;
  });
}

function renderResources() {
  const resources = getFilteredResources();
  const totals = countBy(resources, item => item.resource);
  const verifiedCount = resources.filter(item => item.confirmations.length > 0).length;

  resourceSummary.innerHTML = [
    `<span class="stat"><strong>${resources.length}</strong> pins in view</span>`,
    `<span class="stat"><strong>${totals.water || 0}</strong> water</span>`,
    `<span class="stat"><strong>${totals.restroom || 0}</strong> restrooms</span>`,
    `<span class="stat"><strong>${totals.fishing || 0}</strong> fishing</span>`,
    `<span class="stat"><strong>${verifiedCount}</strong> verified</span>`,
  ].join('');

  if (!resources.length) {
    resourceList.innerHTML = '<div class="empty">No pins yet for this filter. Add the first one.</div>';
    return;
  }

  resourceList.innerHTML = resources.map(item => renderResourceCard(item)).join('');
  decorateResourceCards(resources);
}

function renderMap() {
  if (!map || !markersLayer) return;

  markersLayer.clearLayers();
  const resources = getFilteredResources();
  if (!resources.length) {
    renderPendingMarker();
    return;
  }

  const bounds = [];
  resources.forEach(item => {
    const [lat, lng] = resolveCoords(item);
    bounds.push([lat, lng]);

    const marker = L.marker([lat, lng]).addTo(markersLayer);
    marker.bindPopup(
      `<strong>${escapeHtml(RESOURCE_ICONS[item.resource] || '📍')} ${escapeHtml(item.note)}</strong><br>` +
      `${escapeHtml(item.sector)} · ${escapeHtml(item.access)}<br>` +
      `<small>by ${escapeHtml(item.alias || 'Groundwork')}</small>`
    );
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

  return SECTOR_COORDS[item.sector] || [35.4676, -97.5164];
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
  contactAliases.innerHTML = state.contacts
    .map(contact => `<option value="${escapeAttribute(contact.alias)}"></option>`)
    .join('');

  if (!state.contacts.length) {
    contactList.innerHTML = '<div class="empty">No verified contacts yet.</div>';
    return;
  }

  contactList.innerHTML = state.contacts
    .slice()
    .reverse()
    .map(contact => `
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
    const key = message.toAlias || message.fromAlias || 'Unknown';
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

  const entries = Array.from(grouped.entries()).sort((a, b) => {
    const aLatest = a[1][a[1].length - 1];
    const bLatest = b[1][b[1].length - 1];
    return new Date(bLatest.createdAt) - new Date(aLatest.createdAt);
  });

  if (!currentThread || !grouped.has(currentThread)) {
    currentThread = entries[0][0];
  }

  threadList.innerHTML = entries.map(([alias, msgs]) => {
    const latest = msgs[msgs.length - 1];
    const isOpen = currentThread === alias;

    return `
      <article class="card">
        <div class="card-head">
          <div>
            <h3 class="card-title">${escapeHtml(alias)}</h3>
            <p class="card-subtitle">${escapeHtml(latest.topic || 'general')} · ${formatDate(latest.createdAt)}</p>
          </div>
          <button class="button small" type="button" data-open-thread="${escapeAttribute(alias)}">${isOpen ? 'Open' : 'View'}</button>
        </div>
        ${isOpen ? renderThreadBody(msgs, alias) : `<p class="card-subtitle">${escapeHtml(latest.body || '')}</p>`}
      </article>
    `;
  }).join('');
}

function renderThreadBody(messages, alias) {
  return `
    <div class="message-stack">
      ${messages.map(message => {
        const outgoing = message.author === state.identity.deviceId;
        return `
          <div class="message-bubble ${outgoing ? 'outgoing' : 'incoming'}">
            <div class="message-meta">
              <span>${escapeHtml(message.topic || 'general')}</span>
              <span>${formatDate(message.createdAt)}</span>
            </div>
            <p>${escapeHtml(message.body || '')}</p>
            <div class="message-actions">
              <span class="badge">${outgoing ? 'relay-ready' : 'received'}</span>
              <button class="button small" type="button" data-prefill-contact="${escapeAttribute(alias)}">Reply</button>
            </div>
          </div>
        `;
      }).join('')}
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

function renderGroups() {
  if (!state.groups.length) {
    groupList.innerHTML = '<div class="empty">No groups joined yet. Create one or join with a group ID.</div>';
    return;
  }

  groupList.innerHTML = state.groups
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(group => `
      <article class="card">
        <div class="card-head">
          <div>
            <h3 class="card-title">${escapeHtml(group.name)}</h3>
            <p class="card-subtitle">Group ID ${escapeHtml(group.id)}</p>
          </div>
          <span class="resource-chip">${escapeHtml(group.role || 'member')}</span>
        </div>
        <div class="inline-actions wrap">
          <button class="button small" type="button" data-copy-group="${escapeAttribute(group.id)}">Copy ID</button>
          <button class="button small" type="button" data-leave-group="${escapeAttribute(group.id)}">Leave</button>
        </div>
      </article>
    `).join('');
}

function renderEventShape() {
  eventShape.textContent = JSON.stringify({
    id: 'uuid',
    author: 'device-id',
    prev: 'previous-event-id-or-null',
    kind: [
      'resource.pin.add',
      'resource.pin.confirmed',
      'resource.pin.rated',
      'resource.pin.noted',
      'resource.pin.photo.added',
      'job.posted',
      'planner.requested',
      'dm.sent',
    ].join(' | '),
    createdAt: 'ISO timestamp',
    payload: {
      resource: 'water | restroom | outlet | shade | tree | garden | fishing',
      resourceId: 'present on scorecard events',
      score: 5,
      body: 'optional note',
      photo: 'optional data URL',
      sector: 'Paseo',
      lat: 35.4676,
      lng: -97.5164,
      note: 'one sentence',
      accessibility: {
        adaStatus: 'unknown | ada-confirmed | partial | not-accessible',
        wheelchairAccess: 'unknown | reachable | limited | not-reachable',
        pathSurface: 'unknown | paved | compacted | gravel | grass | mixed',
      },
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
  const coords = Number.isFinite(lat) && Number.isFinite(lng)
    ? [lat, lng]
    : SECTOR_COORDS[sector] || [35.4676, -97.5164];

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
    groupId,
    accessibility: {
      adaStatus: String(fd.get('adaStatus') || 'unknown'),
      wheelchairAccess: String(fd.get('wheelchairAccess') || 'unknown'),
      pathSurface: String(fd.get('pathSurface') || 'unknown'),
    },
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

function handleResourceCardClick(event) {
  const button = event.target.closest('[data-pin-action]');
  if (!button) return;

  const resourceId = button.dataset.resourceId;
  const action = button.dataset.pinAction;
  if (!resourceId || !action) return;

  if (action === 'confirm') {
    appendEvent('resource.pin.confirmed', {
      resourceId,
      alias: state.identity.alias,
    });
    renderResources();
    renderMap();
    toastMessage('Pin confirmed.');
    return;
  }

  if (action === 'rate') {
    const value = window.prompt('Rate this pin from 1 to 5.');
    const score = Number(value);
    if (!Number.isInteger(score) || score < 1 || score > 5) return;

    appendEvent('resource.pin.rated', {
      resourceId,
      score,
      alias: state.identity.alias,
    });
    renderResources();
    renderMap();
    toastMessage('Rating saved.');
    return;
  }

  if (action === 'note') {
    const body = window.prompt('Add a short note or confirmation detail.');
    if (!body || !body.trim()) return;

    appendEvent('resource.pin.noted', {
      resourceId,
      body: body.trim().slice(0, 280),
      alias: state.identity.alias,
    });
    renderResources();
    renderMap();
    toastMessage('Note added.');
    return;
  }

  if (action === 'photo') {
    const card = button.closest('.card');
    const input = card?.querySelector('[data-resource-photo-input]');
    input?.click();
  }
}

async function handleResourceCardChange(event) {
  const input = event.target.closest('[data-resource-photo-input]');
  if (!input || !input.files?.[0]) return;

  const file = input.files[0];
  const photo = await readFileAsDataUrl(file);

  appendEvent('resource.pin.photo.added', {
    resourceId: input.dataset.resourceId,
    photo,
    alias: state.identity.alias,
  });

  input.value = '';
  renderResources();
  renderMap();
  toastMessage('Photo added.');
}

function handleCreateGroup(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const fd = new FormData(form);
  const groupName = String(fd.get('groupName') || '').trim();

  if (!groupName) {
    toastMessage('Add a group name.');
    return;
  }

  const group = {
    id: `group-${crypto.randomUUID().slice(0, 8)}`,
    name: groupName,
    role: 'owner',
    createdAt: new Date().toISOString(),
  };

  state.groups.unshift(group);
  persist();
  form.reset();
  populateScopeDropdowns();
  renderGroups();
  toastMessage('Group created.');
}

function handleJoinGroup(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const fd = new FormData(form);
  const groupId = String(fd.get('groupId') || '').trim();

  if (!groupId) {
    toastMessage('Paste a group ID.');
    return;
  }

  if (state.groups.some(group => group.id === groupId)) {
    toastMessage('You already joined that group.');
    return;
  }

  state.groups.unshift({
    id: groupId,
    name: `Joined group ${groupId.slice(-4)}`,
    role: 'member',
    createdAt: new Date().toISOString(),
  });

  persist();
  form.reset();
  populateScopeDropdowns();
  renderGroups();
  toastMessage('Group joined.');
}

function handleJobSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const fd = new FormData(form);

  const sentence = String(fd.get('sentence') || '').trim();
  const price = Number(fd.get('price'));

  if (!sentence || !Number.isFinite(price)) {
    toastMessage('Add a sentence and price.');
    return;
  }

  appendEvent('job.posted', {
    service: String(fd.get('service') || ''),
    sector: String(fd.get('sector') || ''),
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
  const form = event.currentTarget;
  const fd = new FormData(form);

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
    output: buildPlannerOutput({
      projectType: String(fd.get('projectType') || ''),
      species: String(fd.get('species') || '').trim(),
      sun: String(fd.get('sun') || ''),
      waterAccess: String(fd.get('waterAccess') || ''),
      soil: String(fd.get('soil') || ''),
      month: String(fd.get('month') || ''),
      goal: String(fd.get('goal') || '').trim(),
    }),
  };

  appendEvent('planner.requested', payload);
  form.reset();
  renderPlans();
  toastMessage('Plan generated.');
}

function handleContactSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const fd = new FormData(form);

  const alias = String(fd.get('alias') || '').trim();
  const phrase = String(fd.get('phrase') || '').trim();

  if (!alias || !phrase) {
    toastMessage('Add alias and trust phrase.');
    return;
  }

  state.contacts = [
    { alias, phrase, createdAt: new Date().toISOString() },
    ...state.contacts.filter(contact => contact.alias !== alias),
  ];

  persist();
  form.reset();
  renderContacts();
  toastMessage('Contact saved.');
}

function handleMessageSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const fd = new FormData(form);

  const toAlias = String(fd.get('toAlias') || '').trim();
  const topic = String(fd.get('topic') || '').trim();
  const body = String(fd.get('body') || '').trim();

  if (!toAlias || !body) {
    toastMessage('Add a contact and message.');
    return;
  }

  appendEvent('dm.sent', {
    toAlias,
    fromAlias: state.identity.alias,
    topic,
    body,
  });

  form.reset();
  renderThreads();
  toastMessage('Message queued.');
}

function handleRelaySubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const fd = new FormData(form);
  const url = String(fd.get('url') || '').trim();

  if (!url) {
    toastMessage('Add a relay URL.');
    return;
  }

  if (!state.relays.includes(url)) {
    state.relays.unshift(url);
    state.relays = normalizeRelays(state.relays);
    persist();
  }

  form.reset();
  renderRelays();
  toastMessage('Relay added.');
}

function handleExport() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `groundwork-export-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function handleImport(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const imported = normalizeState(JSON.parse(text));

    const eventIds = new Set(state.events.map(item => item.id));
    imported.events.forEach(item => {
      if (!eventIds.has(item.id)) {
        state.events.push(item);
        eventIds.add(item.id);
      }
    });

    state.groups = dedupeBy([...state.groups, ...imported.groups], item => item.id);
    state.contacts = dedupeBy([...state.contacts, ...imported.contacts], item => item.alias);
    state.relays = normalizeRelays([...state.relays, ...imported.relays]);

    state.events.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
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

function seedDemoData() {
  const existingNotes = new Set(deriveResources().map(item => item.note));
  const seeds = [
    {
      resource: 'water',
      sector: 'Downtown',
      access: 'public',
      note: 'Water fountain inside Ronald J. Norick Downtown Library lobby',
      lat: 35.4681,
      lng: -97.5174,
      alias: 'Groundwork Seed',
      accessibility: { adaStatus: 'ada-confirmed', wheelchairAccess: 'reachable', pathSurface: 'paved' },
    },
    {
      resource: 'restroom',
      sector: 'Downtown',
      access: 'public',
      note: 'Public restroom inside Ronald J. Norick Downtown Library',
      lat: 35.4681,
      lng: -97.5174,
      alias: 'Groundwork Seed',
      accessibility: { adaStatus: 'ada-confirmed', wheelchairAccess: 'reachable', pathSurface: 'paved' },
    },
    {
      resource: 'water',
      sector: 'Midtown',
      access: 'public',
      note: 'Water fountain at Midtown library entry',
      lat: 35.4732,
      lng: -97.5177,
      alias: 'Groundwork Seed',
      accessibility: { adaStatus: 'ada-confirmed', wheelchairAccess: 'reachable', pathSurface: 'paved' },
    },
    {
      resource: 'restroom',
      sector: 'Midtown',
      access: 'public',
      note: 'Restroom inside Midtown library',
      lat: 35.4732,
      lng: -97.5177,
      alias: 'Groundwork Seed',
      accessibility: { adaStatus: 'ada-confirmed', wheelchairAccess: 'reachable', pathSurface: 'paved' },
    },
    {
      resource: 'shade',
      sector: 'Paseo',
      access: 'public',
      note: 'Street tree shade near Paseo arts strip',
      lat: 35.5225,
      lng: -97.5263,
      alias: 'Groundwork Seed',
      accessibility: { adaStatus: 'partial', wheelchairAccess: 'limited', pathSurface: 'mixed' },
    },
  ];

  let added = 0;
  seeds.forEach(seed => {
    if (existingNotes.has(seed.note)) return;
    appendEvent('resource.pin.add', seed);
    added += 1;
  });

  renderResources();
  renderMap();
  toastMessage(added ? `Loaded ${added} demo pins.` : 'Demo pins already loaded.');
}

function renderResourceCard(item) {
  const scopeLabel = item.groupId
    ? (state.groups.find(group => group.id === item.groupId)?.name || 'Group pin')
    : 'Public map';

  return `
    <article class="card">
      <div class="card-head">
        <div>
          <h3 class="card-title">${escapeHtml(RESOURCE_ICONS[item.resource] || '📍')} ${escapeHtml(item.note)}</h3>
          <p class="card-subtitle">${escapeHtml(item.sector)} · ${escapeHtml(item.access)} · ${escapeHtml(scopeLabel)}</p>
        </div>
        <span class="resource-chip">${escapeHtml(item.resource)}</span>
      </div>
      <div class="card-meta">
        <span>by ${escapeHtml(item.alias || 'Groundwork')}</span>
        <span>${formatDate(item.createdAt)}</span>
      </div>
      ${item.photo ? `<img src="${escapeAttribute(item.photo)}" alt="Pin photo">` : ''}
    </article>
  `;
}

function decorateResourceCards(resources) {
  const cards = Array.from(resourceList.querySelectorAll('.card'));

  cards.forEach((card, index) => {
    const resource = resources[index];
    if (!resource) return;

    const existing = card.querySelector('.pin-scorecard');
    if (existing) existing.remove();

    card.insertAdjacentHTML('beforeend', renderResourceScorecard(resource));
  });
}

function renderResourceScorecard(resource) {
  const ratingCount = resource.ratings.length;
  const averageRating = ratingCount
    ? (resource.ratings.reduce((sum, entry) => sum + Number(entry.score || 0), 0) / ratingCount).toFixed(1)
    : '—';

  const photoItems = [
    ...(resource.photo
      ? [{ src: resource.photo, at: resource.createdAt, alias: resource.alias || 'Original pin' }]
      : []),
    ...resource.photos,
  ].slice(-4).reverse();

  const recentComments = resource.comments.slice(-3).reverse();

  return `
    <section class="pin-scorecard">
      <div class="scorecard-grid">
        <div class="scorecard-block">
          <span class="scorecard-label">Rating</span>
          <div class="scorecard-value">${escapeHtml(averageRating)}</div>
          <div class="scorecard-note">${ratingCount} rating${ratingCount === 1 ? '' : 's'}</div>
        </div>

        <div class="scorecard-block">
          <span class="scorecard-label">Confirmations</span>
          <div class="scorecard-value">${resource.confirmations.length}</div>
          <div class="scorecard-note">${
            resource.lastVerifiedAt
              ? `Last verified ${escapeHtml(formatRelative(resource.lastVerifiedAt))}`
              : 'No confirmations yet'
          }</div>
        </div>

        <div class="scorecard-block">
          <span class="scorecard-label">Photos</span>
          <div class="scorecard-value">${photoItems.length}</div>
          <div class="scorecard-note">${photoItems.length ? 'Original plus added proof' : 'No photos yet'}</div>
        </div>
      </div>

      <div class="scorecard-row">
        ${renderAccessibilityChip('ADA', resource.accessibility.adaStatus)}
        ${renderAccessibilityChip('Wheelchair', resource.accessibility.wheelchairAccess)}
        ${renderSurfaceChip(resource.accessibility.pathSurface)}
      </div>

      ${photoItems.length ? `
        <div class="pin-photo-grid">
          ${photoItems.map(photo => `
            <img
              src="${escapeAttribute(photo.src)}"
              alt="Pin photo added ${escapeAttribute(formatRelative(photo.at))}"
            >
          `).join('')}
        </div>
      ` : ''}

      ${recentComments.length ? `
        <div class="pin-comment-list">
          ${recentComments.map(comment => `
            <div class="pin-comment">
              <div class="pin-comment-meta">
                ${escapeHtml(comment.alias || 'Local user')} · ${escapeHtml(formatRelative(comment.at))}
              </div>
              <div class="pin-comment-body">${escapeHtml(comment.body || '')}</div>
            </div>
          `).join('')}
        </div>
      ` : '<div class="scorecard-note">No pin notes yet. Add one after you verify the resource.</div>'}

      <div class="scorecard-actions">
        <button class="button small" type="button" data-pin-action="confirm" data-resource-id="${escapeAttribute(resource.id)}">Confirm working</button>
        <button class="button small" type="button" data-pin-action="rate" data-resource-id="${escapeAttribute(resource.id)}">Rate pin</button>
        <button class="button small" type="button" data-pin-action="note" data-resource-id="${escapeAttribute(resource.id)}">Add note</button>
        <button class="button small" type="button" data-pin-action="photo" data-resource-id="${escapeAttribute(resource.id)}">Add photo</button>
        <input
          class="hidden"
          type="file"
          accept="image/*"
          data-resource-photo-input
          data-resource-id="${escapeAttribute(resource.id)}"
        >
      </div>
    </section>
  `;
}

function renderJobCard(item) {
  return `
    <article class="card">
      <div class="card-head">
        <div>
          <h3 class="card-title">${escapeHtml(item.sentence)}</h3>
          <p class="card-subtitle">${escapeHtml(item.sector)} · posted by ${escapeHtml(item.alias || 'Groundwork')}</p>
        </div>
        <span class="service-chip">${escapeHtml(item.service)}</span>
      </div>
      <div class="card-meta">
        <span>$${escapeHtml(String(item.price))}</span>
        <span>${formatDate(item.createdAt)}</span>
      </div>
      ${item.photo ? `<img src="${escapeAttribute(item.photo)}" alt="Job photo">` : ''}
    </article>
  `;
}

function renderPlanCard(item) {
  return `
    <article class="card">
      <div class="card-head">
        <div>
          <h3 class="card-title">${escapeHtml(item.projectType)}</h3>
          <p class="card-subtitle">${escapeHtml(item.species)} · ${escapeHtml(item.month)}</p>
        </div>
        <span class="resource-chip">plan</span>
      </div>
      <div class="card-meta">
        <span>${escapeHtml(item.sun)}</span>
        <span>${escapeHtml(item.waterAccess)}</span>
        <span>${escapeHtml(item.soil)}</span>
      </div>
      <p class="card-subtitle">${escapeHtml(item.goal)}</p>
      <ul class="mini-list">
        ${item.output.map(step => `<li>${escapeHtml(step)}</li>`).join('')}
      </ul>
    </article>
  `;
}

function buildPlannerOutput(input) {
  const mulchNote = input.waterAccess === 'haul by hand'
    ? 'Mulch heavily and use a basin so every bucket counts.'
    : 'Mulch early to hold moisture and slow weeds.';
  const soilNote = input.soil === 'compacted urban'
    ? 'Loosen only the planting zone and add compost on top instead of flipping the whole bed.'
    : `Match planting density to ${input.soil} soil and keep organic matter on the surface.`;

  return [
    `Start with ${input.projectType} centered on ${input.species || 'your focal species'}.`,
    `Work for ${input.sun} exposure and align the first pass with your goal: ${input.goal || 'care and resilience'}.`,
    mulchNote,
    soilNote,
    `In ${input.month}, plant slow and leave clear walking edges for maintenance and access.`,
  ];
}

function normalizeResourceRecord(resource) {
  const next = { ...resource };

  next.accessibility = {
    adaStatus: String(next.accessibility?.adaStatus || 'unknown'),
    wheelchairAccess: String(next.accessibility?.wheelchairAccess || 'unknown'),
    pathSurface: String(next.accessibility?.pathSurface || 'unknown'),
  };

  next.confirmations = Array.isArray(next.confirmations) ? next.confirmations : [];
  next.ratings = Array.isArray(next.ratings) ? next.ratings : [];
  next.comments = Array.isArray(next.comments) ? next.comments : [];
  next.photos = Array.isArray(next.photos) ? next.photos : [];
  next.lastVerifiedAt = next.lastVerifiedAt || null;

  return next;
}

function renderAccessibilityChip(label, value) {
  const normalized = String(value || 'unknown');
  const labels = {
    'unknown': 'Unknown',
    'ada-confirmed': 'ADA confirmed',
    'partial': 'Partial',
    'not-accessible': 'Not accessible',
    'reachable': 'Reachable',
    'limited': 'Limited',
    'not-reachable': 'Not reachable',
  };

  const tone =
    normalized === 'ada-confirmed' || normalized === 'reachable'
      ? 'good'
      : normalized === 'partial' || normalized === 'limited'
        ? 'warn'
        : normalized === 'not-accessible' || normalized === 'not-reachable'
          ? 'danger'
          : 'info';

  return `<span class="pin-chip ${tone}">${escapeHtml(label)}: ${escapeHtml(labels[normalized] || 'Unknown')}</span>`;
}

function renderSurfaceChip(value) {
  const normalized = String(value || 'unknown');
  const labels = {
    'unknown': 'Unknown surface',
    'paved': 'Paved path',
    'compacted': 'Compacted path',
    'gravel': 'Gravel',
    'grass': 'Grass',
    'mixed': 'Mixed surface',
  };

  const tone =
    normalized === 'paved'
      ? 'good'
      : normalized === 'compacted' || normalized === 'mixed'
        ? 'warn'
        : normalized === 'gravel' || normalized === 'grass'
          ? 'danger'
          : 'info';

  return `<span class="pin-chip ${tone}">${escapeHtml(labels[normalized] || 'Unknown surface')}</span>`;
}

function buildQrCells(deviceId) {
  const chars = Array.from(deviceId || '');
  return Array.from({ length: 25 }, (_, index) => {
    const code = chars[index % Math.max(chars.length, 1)]?.charCodeAt(0) || 0;
    const on = ((code + index) % 3) !== 0;
    return `<span class="qr-cell ${on ? 'on' : ''}"></span>`;
  }).join('');
}

function countBy(items, selector) {
  return items.reduce((acc, item) => {
    const key = selector(item);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function dedupeBy(items, keyFn) {
  const map = new Map();
  items.forEach(item => map.set(keyFn(item), item));
  return Array.from(map.values());
}

function maxIsoTimestamp(a, b) {
  if (!a) return b;
  if (!b) return a;
  return new Date(a) > new Date(b) ? a : b;
}

function formatRelative(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'recently';

  const seconds = Math.max(1, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function toastMessage(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => toast.classList.add('hidden'), 2400);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function capitalize(value) {
  const text = String(value || '');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function roundCoord(value) {
  return Math.round(Number(value) * 1_000_000) / 1_000_000;
}
