
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
  event_pin: 'event.pin.add',
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
  'event.pin.add': 'event_pin',
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

const NEIGHBORHOOD_BOUNDS = {
  'Paseo': { latDelta: 0.008, lngDelta: 0.012 },
  'Plaza': { latDelta: 0.008, lngDelta: 0.012 },
  'Midtown': { latDelta: 0.010, lngDelta: 0.014 },
  'Downtown': { latDelta: 0.012, lngDelta: 0.016 },
  'Innovation District': { latDelta: 0.010, lngDelta: 0.012 },
  'Capitol Hill': { latDelta: 0.010, lngDelta: 0.014 },
  'NE 23rd': { latDelta: 0.010, lngDelta: 0.018 },
  'Southside': { latDelta: 0.014, lngDelta: 0.018 },
};

const RESOURCE_ICONS = {
  water: '💧',
  restroom: '🚻',
  outlet: '🔌',
  shade: '🌳',
  tree: '🍎',
  garden: '🪴',
  fishing: '🎣',
  bike_rack: '🚲',
  trash_can: '🗑️',
};


const NEIGHBORHOOD_MEDIA = {
  'Downtown': {
    image: 'https://assets.simpleviewinc.com/simpleview/image/upload/c_fill,f_jpg,h_800,q_65,w_639/v1/clients/oklahoma/DJI_0038_Enhanced_NR_9828fabc-3956-4192-b353-a1bbf8313248.jpg',
    vibe: 'Streetcar loops, skyline energy, and easy downtown plans.'
  },
  'Midtown': {
    image: 'https://assets.simpleviewinc.com/simpleview/image/upload/c_fill,f_jpg,g_xy_center,h_800,q_65,w_639,x_3680,y_2456/v1/clients/oklahoma/DSC_1270_e95c8055-096e-4d2b-bcd3-2a897f306cd1.jpg',
    vibe: 'Patios, books, coffee, and walkable stops.'
  },
  'Paseo': {
    image: 'https://assets.simpleviewinc.com/simpleview/image/upload/c_fill,f_jpg,g_xy_center,h_800,q_65,w_639,x_1638,y_1967/v1/clients/oklahoma/18_OKC_035_Gen_Paseo_15_31b587ed-3b29-470c-89ce-419daaa51ae4.jpg',
    vibe: 'Color, galleries, and slow wandering.'
  },
  'Plaza': {
    image: 'https://assets.simpleviewinc.com/simpleview/image/upload/c_fill,f_jpg,h_800,q_65,w_639/v1/clients/oklahoma/IMG_1680_d0adf718-11e0-48ae-9564-ac90d566f789.jpg',
    vibe: 'Festival fun, murals, and a little grit.'
  },
  'Capitol Hill': {
    image: 'https://assets.simpleviewinc.com/simpleview/image/upload/c_fill,f_jpg,g_xy_center,h_800,q_65,w_639,x_3232,y_1676/v1/clients/oklahoma/221001_Fiesta_de_las_Americas_2022_Josh_Vaughn_9218_f04cb92d-0168-457f-b62a-12c4b20f7177.jpg',
    vibe: 'Culture, murals, and Calle Dos Cinco energy.'
  },
  'NE 23rd': {
    image: 'https://assets.simpleviewinc.com/simpleview/image/upload/c_fill,f_jpg,h_800,q_65,w_639/v1/clients/oklahoma/Juneteenth_2023_Credit_Tyler_Stark_6_32bad4f4-119e-4350-abbe-efd0b37eb880.jpg',
    vibe: 'East End culture, books, coffee, and community events.'
  },
  'Southside': {
    image: 'https://assets.simpleviewinc.com/simpleview/image/upload/c_fill,f_jpg,g_xy_center,h_800,q_65,w_639,x_3232,y_1676/v1/clients/oklahoma/221001_Fiesta_de_las_Americas_2022_Josh_Vaughn_9218_f04cb92d-0168-457f-b62a-12c4b20f7177.jpg',
    vibe: 'Neighborhood rhythm, practical stops, and community care.'
  },
  'Innovation District': {
    image: 'https://assets.simpleviewinc.com/simpleview/image/upload/c_fill,f_jpg,g_xy_center,h_800,q_65,w_639,x_3680,y_2456/v1/clients/oklahoma/DSC_1270_e95c8055-096e-4d2b-bcd3-2a897f306cd1.jpg',
    vibe: 'Campus energy, new builds, and easy daytime hangs.'
  },
  'all': {
    image: 'https://assets.simpleviewinc.com/simpleview/image/upload/c_fill,f_jpg,h_800,q_65,w_639/v1/clients/oklahoma/DJI_0038_Enhanced_NR_9828fabc-3956-4192-b353-a1bbf8313248.jpg',
    vibe: 'Free things, civic basics, and what is happening nearby.'
  }
};

const INTENT_OPTIONS = [
  { id: 'all', title: 'Everything', copy: 'Show the full neighborhood mix.' },
  { id: 'entertainment', title: 'Entertainment', copy: 'Fun hangs, outings, and scenic stops.' },
  { id: 'interaction', title: 'Interaction', copy: 'Groups, events, and places people gather.' },
  { id: 'purpose', title: 'Purpose', copy: 'Mutual aid, stewardship, and useful next moves.' },
];

const TRAVEL_OPTIONS = [
  { id: 'foot', title: 'Foot', copy: 'Keep it close and easy.' },
  { id: 'scooter', title: 'Scooter / e-bike', copy: 'Stretch out without range stress.' },
  { id: 'car', title: 'Car', copy: 'Wider radius and destination density.' },
];

const state = loadState();

let map = null;
let markersLayer = null;
let eventMarkersLayer = null;
let neighborhoodPolygonsLayer = null;
let pendingLocation = null;
let pendingMarker = null;
let currentThread = null;
let activeIntent = 'all';
let activeTravelMode = 'foot';
let mapPreviewOpen = false;

const routes = ['map', 'jobs', 'events', 'planner', 'groups', 'secure', 'inbox', 'relays', 'about'];
const tabEls = Array.from(document.querySelectorAll('.tab'));
const viewEls = routes.reduce((acc, route) => {
  acc[route] = document.getElementById(`view-${route}`);
  return acc;
}, {});

const resourceForm = document.getElementById('resourceForm');
const jobForm = document.getElementById('jobForm');
const plannerForm = document.getElementById('plannerForm');
const eventForm = document.getElementById('eventForm');
const contactForm = document.getElementById('contactForm');
const messageForm = document.getElementById('messageForm');
const relayForm = document.getElementById('relayForm');
const importInput = document.getElementById('importInput');
const toast = document.getElementById('toast');

const resourceList = document.getElementById('resourceList');
const jobList = document.getElementById('jobList');
const plannerList = document.getElementById('plannerList');
const eventList = document.getElementById('eventList');
const contactList = document.getElementById('contactList');
const threadList = document.getElementById('threadList');
const relayList = document.getElementById('relayList');
const identityCard = document.getElementById('identityCard');
const resourceSummary = document.getElementById('resourceSummary');
const jobSummary = document.getElementById('jobSummary');
const eventSummary = document.getElementById('eventSummary');
const neighborhoodCarousel = document.getElementById('neighborhoodCarousel');
const neighborhoodExploreView = document.getElementById('neighborhoodExploreView');
const cityStageCard = document.getElementById('cityStageCard');
const cityStagePhoto = document.getElementById('cityStagePhoto');
const cityHeroTitle = document.getElementById('cityHeroTitle');
const cityHeroCopy = document.getElementById('cityHeroCopy');
const intentRows = document.getElementById('intentRows');
const topPlansStrip = document.getElementById('topPlansStrip');
const travelModeRows = document.getElementById('travelModeRows');
const featuredEventsPreview = document.getElementById('featuredEventsPreview');
const civicBasicsStrip = document.getElementById('civicBasicsStrip');
const mapPreviewToggle = document.getElementById('mapPreviewToggle');
const mapPreviewSection = document.getElementById('mapPreviewSection');
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
const locationQueryInput = document.getElementById('locationQueryInput');
const lookupLocationButton = document.getElementById('lookupLocationButton');
const selectedLocationCard = document.getElementById('selectedLocationCard');
const regenIdentityButton = document.getElementById('regenIdentityButton');
const copyTrustPhraseButton = document.getElementById('copyTrustPhraseButton');
const exportButton = document.getElementById('exportButton');
const loadBeHeardEventsButton = document.getElementById('loadBeHeardEventsButton');
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
  eventForm?.addEventListener('submit', handleEventSubmit);
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

    if (file) {
      const attached = await populateLocationFromPhotoExif(file);
      if (attached) {
        toastMessage('Location attached from photo EXIF.');
      } else if (!pendingLocation && !String(locationQueryInput?.value || '').trim()) {
        toastMessage('No GPS found in the photo. Search a place or use current location.');
      }
    }
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
  loadBeHeardEventsButton?.addEventListener('click', seedBeHeardEvents);
  focusUserButton?.addEventListener('click', focusUserLocation);
  useLocationButton?.addEventListener('click', applyCurrentLocationToForm);
  lookupLocationButton?.addEventListener('click', handleLookupLocation);
  locationQueryInput?.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    handleLookupLocation();
  });
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

  neighborhoodCarousel?.addEventListener('click', event => {
    const button = event.target.closest('[data-sector-focus]');
    if (!button || !sectorFilter) return;

    const sector = button.dataset.sectorFocus || 'all';
    sectorFilter.value = sector;
    mapPreviewOpen = true;
    renderCityStage();
    renderNeighborhoodCarousel();
    renderIntentRows();
    renderTravelModeRows();
    renderTopPlans();
    renderFeaturedEventsPreview();
    renderCivicBasicsStrip();
    renderMapPreview();
    renderNeighborhoodExploreView();
    renderResources();
    renderMap();
    renderEvents();
  });

  neighborhoodExploreView?.addEventListener('click', event => {
    const card = event.target.closest('[data-sector-focus]');
    if (!card || !sectorFilter) return;

    const sector = card.dataset.sectorFocus || 'all';
    sectorFilter.value = sector;
    mapPreviewOpen = true;
    renderCityStage();
    renderNeighborhoodCarousel();
    renderIntentRows();
    renderTravelModeRows();
    renderTopPlans();
    renderFeaturedEventsPreview();
    renderCivicBasicsStrip();
    renderMapPreview();
    renderNeighborhoodExploreView();
    renderResources();
    renderMap();
    renderEvents();
  });

  intentRows?.addEventListener('click', event => {
    const button = event.target.closest('[data-intent]');
    if (!button) return;
    activeIntent = button.dataset.intent || 'all';
    renderCityStage();
    renderIntentRows();
    renderTravelModeRows();
    renderTopPlans();
    renderFeaturedEventsPreview();
    renderCivicBasicsStrip();
    renderNeighborhoodExploreView();
  });

  travelModeRows?.addEventListener('click', event => {
    const button = event.target.closest('[data-travel-mode]');
    if (!button) return;
    activeTravelMode = button.dataset.travelMode || 'foot';
    renderCityStage();
    renderTravelModeRows();
    renderTopPlans();
    renderFeaturedEventsPreview();
    renderCivicBasicsStrip();
    renderNeighborhoodExploreView();
  });

  mapPreviewToggle?.addEventListener('click', () => {
    mapPreviewOpen = !mapPreviewOpen;
    renderMapPreview();
  });

  topPlansStrip?.addEventListener('click', event => {
    const card = event.target.closest('[data-sector-focus], [data-plan-intent]');
    if (!card) return;

    if (card.dataset.sectorFocus && sectorFilter) {
      sectorFilter.value = card.dataset.sectorFocus || 'all';
    }
    mapPreviewOpen = true;
    if (card.dataset.planIntent) {
      activeIntent = card.dataset.planIntent || 'all';
    }

    renderCityStage();
    renderNeighborhoodCarousel();
    renderIntentRows();
    renderTravelModeRows();
    renderTopPlans();
    renderFeaturedEventsPreview();
    renderCivicBasicsStrip();
    renderMapPreview();
    renderNeighborhoodExploreView();
    renderResources();
    renderMap();
    renderEvents();
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
  eventMarkersLayer = L.layerGroup().addTo(map);
  neighborhoodPolygonsLayer = L.layerGroup().addTo(map);

  map.on('click', async event => {
    pendingLocation = {
      lat: roundCoord(event.latlng.lat),
      lng: roundCoord(event.latlng.lng),
    };
    updatePendingLocationFields();
    renderPendingMarker();
    await populateLocationDetailsFromCoords('Dropped pin');
    toastMessage('Location attached from map.');
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

  navigator.geolocation.getCurrentPosition(async position => {
    pendingLocation = {
      lat: roundCoord(position.coords.latitude),
      lng: roundCoord(position.coords.longitude),
    };
    updatePendingLocationFields();
    renderPendingMarker();
    if (map) map.setView([pendingLocation.lat, pendingLocation.lng], 15);
    await populateLocationDetailsFromCoords('Current location');
    toastMessage('Current location attached.');
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
    resourceForm.placeName.value = '';
    resourceForm.address.value = '';
  }

  if (locationQueryInput) {
    locationQueryInput.value = '';
  }

  if (selectedLocationCard) {
    selectedLocationCard.innerHTML = '';
    selectedLocationCard.classList.add('hidden');
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

async function handleLookupLocation() {
  const rawQuery = String(locationQueryInput?.value || '').trim();
  if (!rawQuery) {
    toastMessage('Type a place name or street address first.');
    return;
  }

  if (lookupLocationButton) lookupLocationButton.disabled = true;

  try {
    const sector = resourceForm?.sector?.value || 'Downtown';
    const match = await geocodePlaceQuery(rawQuery, sector);
    if (!match) {
      toastMessage('Could not find that place.');
      return;
    }

    pendingLocation = { lat: roundCoord(match.lat), lng: roundCoord(match.lng) };
    updatePendingLocationFields();
    renderPendingMarker();

    if (resourceForm) {
      resourceForm.placeName.value = match.placeName;
      resourceForm.address.value = match.address;
    }

    if (locationQueryInput) {
      locationQueryInput.value = match.placeName || match.address;
    }

    renderSelectedLocationCard(match.placeName, match.address, 'Attached from search');
    if (map) map.setView([pendingLocation.lat, pendingLocation.lng], 15);
    toastMessage('Place attached.');
  } catch (error) {
    console.warn(error);
    toastMessage('Lookup failed. Try a fuller address.');
  } finally {
    if (lookupLocationButton) lookupLocationButton.disabled = false;
  }
}

async function populateLocationDetailsFromCoords(fallbackLabel) {
  if (!pendingLocation) return;

  try {
    const match = await reverseGeocodePoint(pendingLocation.lat, pendingLocation.lng);
    if (resourceForm) {
      resourceForm.placeName.value = match.placeName || fallbackLabel;
      resourceForm.address.value = match.address || '';
    }
    if (locationQueryInput && !locationQueryInput.value.trim()) {
      locationQueryInput.value = match.placeName || match.address || fallbackLabel;
    }
    renderSelectedLocationCard(match.placeName || fallbackLabel, match.address, 'Attached from map');
  } catch (error) {
    console.warn(error);
    if (resourceForm) {
      resourceForm.placeName.value = fallbackLabel;
      resourceForm.address.value = '';
    }
    renderSelectedLocationCard(fallbackLabel, '', 'Attached from map');
  }
}

function renderSelectedLocationCard(placeName, address, subtitle) {
  if (!selectedLocationCard) return;

  const lines = [
    placeName ? `<strong>${escapeHtml(placeName)}</strong>` : '',
    address ? `<p>${escapeHtml(address)}</p>` : '',
    subtitle ? `<p class="card-subtitle">${escapeHtml(subtitle)}</p>` : '',
  ].filter(Boolean).join('');

  selectedLocationCard.innerHTML = lines;
  selectedLocationCard.classList.remove('hidden');
}

async function geocodePlaceQuery(query, sector) {
  const biasedQuery = buildBiasedLocationQuery(query, sector);
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('countrycodes', 'us');
  url.searchParams.set('q', biasedQuery);

  const response = await fetch(url.toString(), {
    headers: { 'Accept-Language': 'en-US,en;q=0.9' },
  });
  if (!response.ok) throw new Error(`Geocode failed: ${response.status}`);

  const results = await response.json();
  if (!Array.isArray(results) || !results.length) return null;

  const item = results[0];
  return {
    lat: Number(item.lat),
    lng: Number(item.lon),
    placeName: extractPlaceName(item, query),
    address: item.display_name || '',
  };
}

async function reverseGeocodePoint(lat, lng) {
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lng));

  const response = await fetch(url.toString(), {
    headers: { 'Accept-Language': 'en-US,en;q=0.9' },
  });
  if (!response.ok) throw new Error(`Reverse geocode failed: ${response.status}`);

  const item = await response.json();
  return {
    placeName: extractPlaceName(item, ''),
    address: item.display_name || '',
  };
}

function buildBiasedLocationQuery(query, sector) {
  const text = String(query || '').trim();
  if (!text) return '';

  if (/\b(oklahoma|ok|tulsa|norman|edmond)\b/i.test(text)) return text;

  const sectorBits = sector && sector !== 'all' ? `${sector}, ` : '';
  return `${text}, ${sectorBits}Oklahoma City, OK`;
}

function extractPlaceName(item, fallback) {
  if (!item) return fallback || '';
  if (item.name) return String(item.name);
  if (item.display_name) return String(item.display_name).split(',')[0].trim();
  return fallback || '';
}

async function populateLocationFromPhotoExif(file) {
  if (!window.exifr || !file) return false;

  try {
    const gps = await window.exifr.gps(file);
    const lat = Number(gps?.latitude ?? gps?.lat);
    const lng = Number(gps?.longitude ?? gps?.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;

    pendingLocation = { lat: roundCoord(lat), lng: roundCoord(lng) };
    updatePendingLocationFields();
    renderPendingMarker();
    if (map) map.setView([pendingLocation.lat, pendingLocation.lng], 15);
    await populateLocationDetailsFromCoords('Photo location');
    return true;
  } catch (error) {
    console.warn(error);
    return false;
  }
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

function deriveEvents(options = {}) {
  const { includeExpired = false } = options;
  const events = state.events
    .filter(event => event.kind === 'event.pin.add')
    .map(event => normalizeEventRecord({ ...event.payload, id: event.id, createdAt: event.createdAt }))
    .sort((a, b) => new Date(resolveEventStart(a)) - new Date(resolveEventStart(b)));

  return includeExpired ? events : events.filter(item => !isEventExpired(item));
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
  renderCityStage();
  renderNeighborhoodCarousel();
  renderIntentRows();
  renderTravelModeRows();
  renderTopPlans();
  renderFeaturedEventsPreview();
  renderCivicBasicsStrip();
  renderMapPreview();
  renderNeighborhoodExploreView();
  renderResources();
  renderMap();
  renderJobs();
  renderEvents();
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

  return resources
    .filter(item => {
      const itemScope = item.groupId ? item.groupId : 'public';
      const scopeOk = scopeValue === 'public' ? itemScope === 'public' : itemScope === scopeValue;
      const typeOk = typeValue === 'all' || item.resource === typeValue;
      const sectorOk = sectorValue === 'all' || item.sector === sectorValue;
      return scopeOk && typeOk && sectorOk;
    })
    .sort((a, b) => getResourcePriorityScore(b) - getResourcePriorityScore(a));
}

function getResourcePriorityScore(item) {
  const scoreMap = {
    water: 9, restroom: 9, shade: 8, outlet: 8, bike_rack: 7, trash_can: 7, garden: 6, fishing: 5, tree: 5,
  };
  let score = scoreMap[item.resource] || 4;
  if (item.confirmations?.length) score += 2;
  if (item.photo || item.photos?.length) score += 1;
  if (activeIntent === 'entertainment' && ['garden','fishing','shade','tree'].includes(item.resource)) score += 3;
  if (activeIntent === 'interaction' && ['restroom','water','shade'].includes(item.resource)) score += 2;
  if (activeIntent === 'purpose' && ['garden','trash_can','water','restroom','bike_rack'].includes(item.resource)) score += 3;
  if (activeTravelMode === 'foot' && ['water','restroom','shade'].includes(item.resource)) score += 2;
  if (activeTravelMode === 'scooter' && ['bike_rack','outlet','water','shade'].includes(item.resource)) score += 3;
  if (activeTravelMode === 'car' && ['restroom','trash_can','outlet'].includes(item.resource)) score += 1;
  return score;
}

function renderResources() {
  const resources = getFilteredResources();
  const totals = countBy(resources, item => item.resource);
  const verifiedCount = resources.filter(item => item.confirmations.length > 0).length;

  resourceSummary.innerHTML = [
    `<span class="stat"><strong>${resources.length}</strong> pins in view</span>`,
    `<span class="stat"><strong>${totals.water || 0}</strong> water</span>`,
    `<span class="stat"><strong>${totals.restroom || 0}</strong> restrooms</span>`,
    `<span class="stat"><strong>${totals.bike_rack || 0}</strong> bike racks</span>`,
    `<span class="stat"><strong>${totals.trash_can || 0}</strong> trash cans</span>`,
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
  if (!map || !markersLayer || !eventMarkersLayer) return;

  markersLayer.clearLayers();
  eventMarkersLayer.clearLayers();
  neighborhoodPolygonsLayer?.clearLayers();

  const resources = getFilteredResources();
  const events = getRenderableEvents();
  const bounds = [];

  renderNeighborhoodPolygons();

  if (!resources.length && !events.length) {
    renderPendingMarker();
    return;
  }

  resources.forEach(item => {
    const [lat, lng] = resolveCoords(item);
    bounds.push([lat, lng]);

    const marker = L.marker([lat, lng]).addTo(markersLayer);
    marker.bindPopup(
      `<strong>${escapeHtml(RESOURCE_ICONS[item.resource] || '📍')} ${escapeHtml(item.note)}</strong><br>` +
      `${item.placeName ? `${escapeHtml(item.placeName)}<br>` : ''}` +
      `${item.address ? `${escapeHtml(item.address)}<br>` : ''}` +
      `${escapeHtml(item.sector)} · ${escapeHtml(item.access)}<br>` +
      `<small>by ${escapeHtml(item.alias || 'Groundwork')}</small>`
    );
  });

  events.forEach(item => {
    const [lat, lng] = resolveCoords(item);
    bounds.push([lat, lng]);

    const marker = L.marker([lat, lng], {
      icon: L.divIcon({ className: 'event-map-marker', html: '📅' })
    }).addTo(eventMarkersLayer);

    marker.bindPopup(
      `<strong>📅 ${escapeHtml(item.title)}</strong><br>` +
      `${item.placeName ? `${escapeHtml(item.placeName)}<br>` : ''}` +
      `${item.address ? `${escapeHtml(item.address)}<br>` : ''}` +
      `${escapeHtml(formatEventSchedule(item))}<br>` +
      `<small>${escapeHtml(item.organizer || 'Groundwork')}</small>`
    );
  });

  if (bounds.length === 1) {
    map.setView(bounds[0], 14);
  } else {
    map.fitBounds(bounds, { padding: [30, 30] });
  }

  renderPendingMarker();
}



function getNeighborhoodMedia(sector) {
  return NEIGHBORHOOD_MEDIA[sector] || NEIGHBORHOOD_MEDIA.all;
}

function renderCityStage() {
  const focusedSector = getFocusedSector();
  const media = getNeighborhoodMedia(focusedSector || 'all');

  if (cityHeroTitle) {
    cityHeroTitle.textContent = focusedSector || 'Oklahoma City';
  }

  if (cityHeroCopy) {
    cityHeroCopy.textContent = getIntentLeadCopy(focusedSector, activeIntent, media.vibe);
  }

  if (cityStagePhoto) {
    cityStagePhoto.style.backgroundImage = `url("${media.image}")`;
  }

  cityStageCard?.classList.toggle('is-neighborhood-focused', Boolean(focusedSector));
}

function renderIntentRows() {
  if (!intentRows) return;

  intentRows.innerHTML = INTENT_OPTIONS.map(option => `
    <button
      type="button"
      class="intent-chip ${option.id === activeIntent ? 'is-active' : ''}"
      data-intent="${escapeAttribute(option.id)}"
    >
      <strong>${escapeHtml(option.title)}</strong>
      <span>${escapeHtml(option.copy)}</span>
    </button>
  `).join('');
}

function renderTravelModeRows() {
  if (!travelModeRows) return;

  travelModeRows.innerHTML = TRAVEL_OPTIONS.map(option => `
    <button
      type="button"
      class="travel-chip ${option.id === activeTravelMode ? 'is-active' : ''}"
      data-travel-mode="${escapeAttribute(option.id)}"
    >
      <strong>${escapeHtml(option.title)}</strong>
      <span>${escapeHtml(option.copy)}</span>
    </button>
  `).join('');
}

function renderFeaturedEventsPreview() {
  if (!featuredEventsPreview) return;
  const events = getFilteredEvents().slice(0, 4);
  if (!events.length) {
    featuredEventsPreview.innerHTML = '<div class="empty">Nothing active or upcoming here yet. Try another neighborhood or load the BeHeard seed.</div>';
    return;
  }

  featuredEventsPreview.innerHTML = events.map(item => {
    const date = getEventDateParts(item);
    const priceClass = (item.priceTier || 'free').replace(/[^a-z0-9-]/gi, '-');
    const status = isEventLive(item) ? 'live' : 'today';
    return `
      <article class="featured-event-row">
        <div class="featured-event-date"><span>${escapeHtml(date.month)}</span><strong>${escapeHtml(date.day)}</strong></div>
        <div class="featured-event-copy">
          <h4>${escapeHtml(item.title)}</h4>
          <p>${escapeHtml(item.placeName || item.address || item.sector || 'Oklahoma City')}</p>
          <div class="featured-event-meta">
            <span class="status-chip ${status}">${isEventLive(item) ? 'Live now' : 'Upcoming'}</span>
            <span class="price-chip ${priceClass}">${escapeHtml(getPriceLabel(item.priceTier))}</span>
          </div>
        </div>
        <div class="card-meta"><span>${escapeHtml(formatEventSchedule(item))}</span></div>
      </article>
    `;
  }).join('');
}

function renderCivicBasicsStrip() {
  if (!civicBasicsStrip) return;
  const resources = getFilteredResources();
  const groups = [
    ['water', 'Water'],
    ['restroom', 'Restroom'],
    ['shade', 'Shade'],
    ['outlet', 'Outlet'],
    ['bike_rack', 'Bike rack'],
    ['trash_can', 'Trash can'],
  ];

  civicBasicsStrip.innerHTML = groups.map(([key, label]) => {
    const count = resources.filter(item => item.resource === key).length;
    return `<div class="basic-chip"><strong>${escapeHtml(label)}</strong><span>${count} nearby</span></div>`;
  }).join('');
}

function renderMapPreview() {
  if (!mapPreviewSection || !mapPreviewToggle) return;
  mapPreviewSection.classList.toggle('is-collapsed', !mapPreviewOpen);
  mapPreviewToggle.textContent = mapPreviewOpen ? 'Hide map' : 'Show map';
  if (mapPreviewOpen && map) setTimeout(() => map.invalidateSize(), 50);
}

function getEventDateParts(event) {
  const dateText = resolveEventStart(event);
  const parsed = new Date(dateText);
  if (Number.isNaN(parsed.getTime())) return { month: 'Soon', day: '•' };
  return {
    month: parsed.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    day: String(parsed.getDate()),
  };
}

function getPriceLabel(value) {
  const map = { free: 'Free', 'under-10': 'Under $10', paid: 'Paid' };
  return map[value] || 'Free';
}

function renderTopPlans() {
  if (!topPlansStrip) return;

  const focusedSector = getFocusedSector();
  const cards = buildTopPlanCards(focusedSector, activeIntent);

  topPlansStrip.innerHTML = cards.map(card => `
    <article class="top-plan-card" data-sector-focus="${escapeAttribute(card.sector)}" data-plan-intent="${escapeAttribute(card.intent)}" tabindex="0">
      <img class="top-plan-photo" src="${escapeAttribute(card.image)}" alt="${escapeAttribute(card.title)}">
      <div class="top-plan-overlay"></div>
      <div class="top-plan-body">
        <div class="top-plan-kicker">${escapeHtml(card.sector)} · ${escapeHtml(card.chip)}</div>
        <h3 class="top-plan-title">${escapeHtml(card.title)}</h3>
        <p class="top-plan-copy">${escapeHtml(card.copy)}</p>
        <div class="top-plan-meta">
          <span>${escapeHtml(card.length)}</span>
          <span>${escapeHtml(card.stops)}</span>
        </div>
      </div>
    </article>
  `).join('');
}

function getIntentLeadCopy(focusedSector, intent, fallbackVibe) {
  const place = focusedSector || 'Oklahoma City';
  const travelMap = { foot: 'on foot', scooter: 'by scooter or e-bike', car: 'by car' };
  const travelText = travelMap[activeTravelMode] || 'nearby';
  const map = {
    all: `Free things, civic basics, and what is happening nearby in ${place}, ${travelText}.`,
    entertainment: `Entertainment-first picks in ${place}: easy hangs, scenic stops, and a light day out ${travelText}.`,
    interaction: `Groups, events, and social energy in ${place}, tuned for moving ${travelText}.`,
    purpose: `Useful moves in ${place}: volunteering, stewardship, small jobs, and places that help people ${travelText}.`,
  };
  return map[intent] || fallbackVibe || map.all;
}

function buildTopPlanCards(focusedSector, intent) {
  const sectors = focusedSector ? [focusedSector] : ['Midtown', 'Paseo', 'Plaza'];
  const resources = deriveResources();
  const events = deriveEvents({ includeExpired: false });

  return sectors.slice(0, 4).map((sector, index) => {
    const media = getNeighborhoodMedia(sector);
    const sectorResources = resources.filter(item => item.sector === sector);
    const sectorEvents = events.filter(item => item.sector === sector);

    const plansByIntent = {
      all: {
        title: index % 2 === 0 ? 'Start here' : 'Easy afternoon',
        chip: sectorEvents.length ? 'Free + nearby' : 'Neighborhood plan',
        copy: sectorEvents.length
          ? `Catch ${sectorEvents[0].title} and keep the day easy with civic basics nearby.`
          : `${media.vibe} Start with a simple neighborhood loop and follow what feels open.`,
        length: sectorEvents.length ? '90 min to 2 hrs' : '1 to 2 hrs',
        stops: sectorResources.length ? `${Math.min(sectorResources.length, 3)} easy stops` : 'Open-ended',
      },
      entertainment: {
        title: 'Things to do',
        chip: 'Entertainment',
        copy: sectorEvents.length
          ? `Lead with ${sectorEvents[0].title}, then keep going through a few scenic or fun stops.`
          : `Use ${sector} for a low-pressure entertainment loop with places worth lingering.`,
        length: '1 to 3 hrs',
        stops: sectorResources.filter(item => ['garden', 'fishing', 'shade'].includes(item.resource)).length
          ? 'Scenic stops'
          : 'Flexible loop',
      },
      interaction: {
        title: 'Go where people are',
        chip: 'Interaction',
        copy: sectorEvents.length
          ? `Start with ${sectorEvents[0].title} and build the rest of the day around live gathering points.`
          : `No big event loaded yet, but ${sector} still works as a social starting point.`,
        length: 'Tonight / this week',
        stops: sectorEvents.length ? `${sectorEvents.length} event options` : 'Watch this neighborhood',
      },
      purpose: {
        title: 'Useful next move',
        chip: 'Purpose',
        copy: `Start in ${sector} with practical stops, care infrastructure, and places that can turn into action.`,
        length: 'Quick errand to half day',
        stops: sectorResources.filter(item => ['trash_can', 'garden', 'bike_rack', 'water', 'restroom'].includes(item.resource)).length
          ? 'Basics + civic stops'
          : 'Practical loop',
      },
    };

    const plan = plansByIntent[intent] || plansByIntent.all;
    const travelMeta = { foot: 'Best close by', scooter: 'Good on a scooter', car: 'Worth the drive' };
    return {
      sector,
      intent,
      image: media.image,
      ...plan,
      chip: `${plan.chip} · ${travelMeta[activeTravelMode] || 'Nearby'}`,
    };
  });
}


function renderNeighborhoodCarousel() {
  if (!neighborhoodCarousel) return;

  const activeSector = sectorFilter?.value || 'all';
  const sectors = ['all', ...Object.keys(SECTOR_COORDS)];
  const allResources = deriveResources();
  const allEvents = deriveEvents({ includeExpired: false });
  const hasFocus = activeSector !== 'all';

  neighborhoodCarousel.classList.toggle('has-focus', hasFocus);
  neighborhoodCarousel.innerHTML = sectors.map(sector => {
    const isActive = sector === activeSector;
    const label = sector === 'all' ? 'All neighborhoods' : sector;
    const resourceCount = sector === 'all'
      ? allResources.length
      : allResources.filter(item => item.sector === sector).length;
    const eventCount = sector === 'all'
      ? allEvents.length
      : allEvents.filter(item => item.sector === sector).length;

    return `
      <button
        type="button"
        class="neighborhood-pill ${isActive ? 'is-active' : ''} ${hasFocus && !isActive ? 'is-dimmed' : ''}"
        data-sector-focus="${escapeAttribute(sector)}"
      >
        ${escapeHtml(label)}
        <small>${resourceCount} pins · ${eventCount} events</small>
      </button>
    `;
  }).join('');
}


function renderNeighborhoodExploreView() {
  if (!neighborhoodExploreView) return;

  const activeSector = sectorFilter?.value || 'all';
  const sectors = Object.keys(SECTOR_COORDS);
  const resources = deriveResources();
  const events = deriveEvents({ includeExpired: false });
  const hasFocus = activeSector !== 'all';

  const ordered = (hasFocus
    ? [activeSector, ...sectors.filter(sector => sector !== activeSector)]
    : sectors).slice(0, hasFocus ? 3 : 4);

  neighborhoodExploreView.innerHTML = `
    <div class="neighborhood-explore-grid">
      ${ordered.map(sector => {
        const resourceCount = resources.filter(item => item.sector === sector).length;
        const eventCount = events.filter(item => item.sector === sector).length;
        const topResources = resources.filter(item => item.sector === sector).slice(0, 2);
        const topEvents = events.filter(item => item.sector === sector).slice(0, 1);
        const isActive = sector === activeSector;
        const media = getNeighborhoodMedia(sector);

        return `
          <article
            class="neighborhood-card ${isActive ? 'is-active' : ''} ${hasFocus && !isActive ? 'is-dimmed' : ''}"
            data-sector-focus="${escapeAttribute(sector)}"
            tabindex="0"
          >
            <img class="neighborhood-card-photo" src="${escapeAttribute(media.image)}" alt="${escapeAttribute(sector)} neighborhood">
            <div class="neighborhood-card-overlay"></div>
            <div class="neighborhood-card-body">
              <div>
                <h3 class="neighborhood-card-title">${escapeHtml(sector)}</h3>
                <div class="neighborhood-card-meta">
                  <span>${resourceCount} pins</span>
                  <span>${eventCount} events</span>
                </div>
              </div>
              <p class="neighborhood-card-copy">${escapeHtml(buildNeighborhoodSummary(sector, topResources, topEvents))}</p>
              <div class="card-meta">
                <span>${escapeHtml(media.vibe)}</span>
              </div>
            </div>
          </article>
        `;
      }).join('')}
    </div>
  `;
}

function buildNeighborhoodSummary(sector, topResources, topEvents) {
  const resourceText = topResources.length
    ? `Pins include ${topResources.map(item => item.resource.replace('_', ' ')).join(', ')}.`
    : 'No pins yet.';
  const eventText = topEvents.length
    ? ` Next event: ${topEvents[0].title}.`
    : ' No upcoming events yet.';
  return `${sector} focus.${resourceText}${eventText}`;
}

function renderNeighborhoodPolygons() {
  if (!map || !neighborhoodPolygonsLayer) return;

  const activeSector = sectorFilter?.value || 'all';
  const hasFocus = activeSector !== 'all';
  const sectors = Object.keys(SECTOR_COORDS);

  sectors.forEach(sector => {
    const polygonPoints = buildNeighborhoodPolygon(sector);
    if (!polygonPoints.length) return;

    const isActive = sector === activeSector || !hasFocus;
    const polygon = L.polygon(polygonPoints, {
      weight: isActive && hasFocus ? 3 : 2,
      opacity: isActive ? 0.75 : 0.22,
      fillOpacity: isActive ? (hasFocus ? 0.16 : 0.06) : 0.03,
    });

    polygon.bindTooltip(sector);
    polygon.addTo(neighborhoodPolygonsLayer);
  });
}

function buildNeighborhoodPolygon(sector) {
  const center = SECTOR_COORDS[sector];
  const bounds = NEIGHBORHOOD_BOUNDS[sector];
  if (!center || !bounds) return [];

  const [lat, lng] = center;
  const { latDelta, lngDelta } = bounds;

  return [
    [lat + latDelta, lng - lngDelta],
    [lat + latDelta, lng + lngDelta],
    [lat - latDelta, lng + lngDelta],
    [lat - latDelta, lng - lngDelta],
  ];
}

function resolveCoords(item) {
  if (Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng))) {
    return [Number(item.lat), Number(item.lng)];
  }

  return SECTOR_COORDS[item.sector] || [35.4676, -97.5164];
}

function renderEvents() {
  const events = getFilteredEvents();
  const totals = countBy(events, item => item.priceTier || 'free');
  const liveCount = events.filter(isEventLive).length;
  const upcomingCount = events.filter(item => !isEventLive(item)).length;
  const focusedSector = getFocusedSector();

  if (eventSummary) {
    eventSummary.innerHTML = [
      `<span class="stat"><strong>${events.length}</strong> active + upcoming</span>`,
      `<span class="stat"><strong>${liveCount}</strong> live now</span>`,
      `<span class="stat"><strong>${upcomingCount}</strong> upcoming</span>`,
      `<span class="stat"><strong>${totals['free'] || 0}</strong> free</span>`,
      focusedSector ? `<span class="stat"><strong>${escapeHtml(focusedSector)}</strong> focus</span>` : ''
    ].filter(Boolean).join('');
  }

  if (!eventList) return;
  if (!events.length) {
    eventList.innerHTML = focusedSector
      ? `<div class="empty">No active or upcoming events in ${escapeHtml(focusedSector)} yet.</div>`
      : '<div class="empty">No active or upcoming ephemeral events yet. Add one or load the BeHeard OKC seed.</div>';
    return;
  }

  eventList.innerHTML = events.map(item => renderEventCard(item)).join('');
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
      'event.pin.add',
      'job.posted',
      'planner.requested',
      'dm.sent',
    ].join(' | '),
    createdAt: 'ISO timestamp',
    payload: {
      resource: 'water | restroom | outlet | shade | tree | garden | fishing',
      title: 'BeHeard OKC donation drop-off',
      organizer: 'BeHeard Movement',
      priceTier: 'free | under-10 | paid',
      resourceId: 'present on scorecard events',
      score: 5,
      body: 'optional note',
      photo: 'optional data URL',
      sector: 'Paseo',
      placeName: 'Homeless Alliance WestTown',
      address: '1724 NW 4th St, Oklahoma City, OK 73106',
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
  let lat = Number(fd.get('lat'));
  let lng = Number(fd.get('lng'));
  let placeName = String(fd.get('placeName') || '').trim();
  let address = String(fd.get('address') || '').trim();
  const rawLocationQuery = String(fd.get('locationQuery') || '').trim();

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    if (rawLocationQuery) {
      try {
        const match = await geocodePlaceQuery(rawLocationQuery, sector);
        if (match) {
          lat = roundCoord(match.lat);
          lng = roundCoord(match.lng);
          placeName = placeName || match.placeName;
          address = address || match.address;
          pendingLocation = { lat, lng };
          updatePendingLocationFields();
          renderPendingMarker();
          if (resourceForm) {
            resourceForm.placeName.value = placeName;
            resourceForm.address.value = address;
          }
          renderSelectedLocationCard(placeName, address, 'Attached on submit');
        }
      } catch (error) {
        console.warn(error);
      }
    }
  }

  if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && resourceForm?.photo?.files?.[0]) {
    const attached = await populateLocationFromPhotoExif(resourceForm.photo.files[0]);
    if (attached) {
      lat = Number(resourceForm.lat.value);
      lng = Number(resourceForm.lng.value);
      placeName = String(resourceForm.placeName.value || placeName).trim();
      address = String(resourceForm.address.value || address).trim();
    }
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    toastMessage('Attach a place, let photo EXIF fill it, use current location, or tap the map before posting.');
    return;
  }

  if (!placeName && !address) {
    try {
      const match = await reverseGeocodePoint(lat, lng);
      placeName = match.placeName || placeName;
      address = match.address || address;
    } catch (error) {
      console.warn(error);
    }
  }

  const scopeValue = fd.get('scope') || 'public';
  const groupId = scopeValue === 'public' ? null : scopeValue;

  appendEvent('resource.pin.add', {
    resource: fd.get('resource'),
    sector,
    access: fd.get('access'),
    note,
    lat,
    lng,
    placeName,
    address,
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

async function handleEventSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const fd = new FormData(form);

  const title = String(fd.get('title') || '').trim();
  const organizer = String(fd.get('organizer') || '').trim() || 'Groundwork';
  const sector = String(fd.get('sector') || 'Downtown');
  const locationQuery = String(fd.get('locationQuery') || '').trim();
  const date = String(fd.get('date') || '').trim();
  const startTime = String(fd.get('startTime') || '').trim();
  const endTime = String(fd.get('endTime') || '').trim();

  if (!title || !locationQuery) {
    toastMessage('Add a title and a place or address for the event.');
    return;
  }

  let match = null;
  try {
    match = await geocodePlaceQuery(locationQuery, sector);
  } catch (error) {
    console.warn(error);
  }

  if (!match) {
    toastMessage('Could not locate that event place.');
    return;
  }

  appendEvent('event.pin.add', {
    title,
    organizer,
    sector,
    priceTier: String(fd.get('priceTier') || 'free'),
    note: String(fd.get('note') || '').trim(),
    url: String(fd.get('url') || '').trim(),
    placeName: match.placeName,
    address: match.address,
    lat: roundCoord(match.lat),
    lng: roundCoord(match.lng),
    date,
    startTime,
    endTime,
  });

  form.reset();
  renderEvents();
  renderMap();
  toastMessage('Event posted locally.');
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

async function seedBeHeardEvents() {
  const existingTitles = new Set(deriveEvents({ includeExpired: true }).map(item => `${item.title}|${item.date}|${item.startTime}|${item.address}`));
  const seeds = [
    {
      title: 'BeHeard OKC outreach',
      organizer: 'BeHeard Movement',
      sector: 'Southside',
      priceTier: 'free',
      placeName: 'BeHeard OKC outreach stop',
      address: '1725 SE 59th St, Oklahoma City, OK',
      note: 'Bring what you can. Rain may cancel outreach. Check organizer updates before heading out.',
      url: 'https://bhmovement.org/OKC',
      date: '2026-05-09',
      startTime: '10:00',
      endTime: '14:00',
      scheduleText: 'Sat May 9 · 10:00 AM–2:00 PM',
    },
    {
      title: 'BeHeard OKC outreach',
      organizer: 'BeHeard Movement',
      sector: 'Plaza',
      priceTier: 'free',
      placeName: 'Second Chances Thrift',
      address: '2605 N MacArthur Blvd, Oklahoma City, OK',
      note: 'Recurring BeHeard OKC stop. Rain may cancel outreach. Check organizer updates before heading out.',
      url: 'https://bhmovement.org/OKC',
      date: '2026-05-12',
      startTime: '10:00',
      endTime: '15:00',
      scheduleText: 'Tue May 12 · 10:00 AM–3:00 PM',
    },
    {
      title: 'BeHeard OKC outreach',
      organizer: 'BeHeard Movement',
      sector: 'Midtown',
      priceTier: 'free',
      placeName: 'BeHeard OKC outreach stop',
      address: '1329 NW 23rd St, Oklahoma City, OK',
      note: 'Rain may cancel outreach. Check organizer updates before heading out.',
      url: 'https://bhmovement.org/OKC',
      date: '2026-05-14',
      startTime: '10:00',
      endTime: '15:00',
      scheduleText: 'Thu May 14 · 10:00 AM–3:00 PM',
    },
    {
      title: 'BeHeard OKC outreach',
      organizer: 'BeHeard Movement',
      sector: 'Southside',
      priceTier: 'free',
      placeName: 'BeHeard OKC outreach stop',
      address: '11513 S Western Ave, Oklahoma City, OK',
      note: 'Rain may cancel outreach. Check organizer updates before heading out.',
      url: 'https://bhmovement.org/OKC',
      date: '2026-05-16',
      startTime: '10:00',
      endTime: '14:00',
      scheduleText: 'Sat May 16 · 10:00 AM–2:00 PM',
    },
    {
      title: 'BeHeard OKC outreach',
      organizer: 'BeHeard Movement',
      sector: 'Plaza',
      priceTier: 'free',
      placeName: 'Second Chances Thrift',
      address: '2605 N MacArthur Blvd, Oklahoma City, OK',
      note: 'Recurring BeHeard OKC stop. Rain may cancel outreach. Check organizer updates before heading out.',
      url: 'https://bhmovement.org/OKC',
      date: '2026-05-19',
      startTime: '10:00',
      endTime: '15:00',
      scheduleText: 'Tue May 19 · 10:00 AM–3:00 PM',
    },
    {
      title: 'BeHeard OKC nighttime outreach',
      organizer: 'BeHeard Movement',
      sector: 'Midtown',
      priceTier: 'free',
      placeName: 'BeHeard OKC outreach stop',
      address: '1329 NW 23rd St, Oklahoma City, OK',
      note: 'Nighttime outreach. Rain may cancel outreach. Check organizer updates before heading out.',
      url: 'https://bhmovement.org/OKC',
      date: '2026-05-21',
      startTime: '15:00',
      endTime: '21:00',
      scheduleText: 'Thu May 21 · 3:00 PM–9:00 PM',
    },
  ];

  let added = 0;
  for (const seed of seeds) {
    const dedupeKey = `${seed.title}|${seed.date}|${seed.startTime}|${seed.address}`;
    if (existingTitles.has(dedupeKey)) continue;

    let coords = null;
    if (seed.address || seed.placeName) {
      try {
        const match = await geocodePlaceQuery(seed.address || seed.placeName, seed.sector);
        coords = match ? [roundCoord(match.lat), roundCoord(match.lng)] : null;
        if (match) {
          seed.placeName = match.placeName || seed.placeName;
          seed.address = match.address || seed.address;
        }
      } catch (error) {
        console.warn(error);
      }
    }

    appendEvent('event.pin.add', {
      ...seed,
      lat: coords ? coords[0] : null,
      lng: coords ? coords[1] : null,
    });
    added += 1;
  }

  renderEvents();
  renderMap();
  toastMessage(added ? `Loaded ${added} BeHeard OKC events.` : 'BeHeard OKC events already loaded.');
}

async function seedDemoData() {
  const existingNotes = new Set(deriveResources().map(item => item.note));
  const seeds = [
    {
      resource: 'water',
      sector: 'Downtown',
      access: 'public',
      note: 'Water fountain inside Ronald J. Norick Downtown Library lobby',
      placeName: 'Ronald J. Norick Downtown Library',
      address: '300 Park Ave, Oklahoma City, OK 73102',
      alias: 'Groundwork Seed',
      accessibility: { adaStatus: 'ada-confirmed', wheelchairAccess: 'reachable', pathSurface: 'paved' },
    },
    {
      resource: 'restroom',
      sector: 'Downtown',
      access: 'public',
      note: 'Public restroom inside Ronald J. Norick Downtown Library',
      placeName: 'Ronald J. Norick Downtown Library',
      address: '300 Park Ave, Oklahoma City, OK 73102',
      alias: 'Groundwork Seed',
      accessibility: { adaStatus: 'ada-confirmed', wheelchairAccess: 'reachable', pathSurface: 'paved' },
    },
    {
      resource: 'water',
      sector: 'Downtown',
      access: 'public',
      note: 'Water access and day services at Homeless Alliance WestTown campus',
      placeName: 'Homeless Alliance WestTown Homeless Resource Campus',
      address: '1724 NW 4th St, Oklahoma City, OK 73106',
      alias: 'Groundwork Seed',
      accessibility: { adaStatus: 'ada-confirmed', wheelchairAccess: 'reachable', pathSurface: 'paved' },
    },
    {
      resource: 'restroom',
      sector: 'Downtown',
      access: 'public',
      note: 'Restroom and day shelter access at Homeless Alliance Day Shelter',
      placeName: 'Homeless Alliance Day Shelter',
      address: '1729 NW 3rd St, Oklahoma City, OK 73106',
      alias: 'Groundwork Seed',
      accessibility: { adaStatus: 'ada-confirmed', wheelchairAccess: 'reachable', pathSurface: 'paved' },
    },
    {
      resource: 'restroom',
      sector: 'Downtown',
      access: 'public',
      note: 'Winter shelter intake point at Homeless Alliance campus',
      placeName: 'Homeless Alliance Winter Shelter',
      address: '1601 NW 4th St, Oklahoma City, OK 73106',
      alias: 'Groundwork Seed',
      accessibility: { adaStatus: 'partial', wheelchairAccess: 'reachable', pathSurface: 'paved' },
    },
  ];

  let added = 0;
  for (const seed of seeds) {
    if (existingNotes.has(seed.note)) continue;

    let coords = null;
    try {
      const match = await geocodePlaceQuery(seed.address || seed.placeName, seed.sector);
      coords = match ? [roundCoord(match.lat), roundCoord(match.lng)] : null;
    } catch (error) {
      console.warn(error);
    }

    appendEvent('resource.pin.add', {
      ...seed,
      lat: coords ? coords[0] : (SECTOR_COORDS[seed.sector] || [35.4676, -97.5164])[0],
      lng: coords ? coords[1] : (SECTOR_COORDS[seed.sector] || [35.4676, -97.5164])[1],
    });
    added += 1;
  }

  renderResources();
  renderMap();
  toastMessage(added ? `Loaded ${added} seed pins.` : 'Seed pins already loaded.');
}

function renderEventCard(item) {
  const priceLabel = item.priceTier === 'under-10' ? 'Under $10' : item.priceTier === 'paid' ? 'Paid' : 'Free';
  const locationLine = [item.placeName, item.address].filter(Boolean).join(' · ');

  return `
    <article class="card">
      <div class="card-head">
        <div>
          <h3 class="card-title">📅 ${escapeHtml(item.title)}</h3>
          <p class="card-subtitle">${escapeHtml(item.organizer || 'Groundwork')} · ${escapeHtml(item.sector)}</p>
        </div>
        <span class="event-chip">${escapeHtml(priceLabel)}</span>
      </div>
      <div class="card-meta">
        <span>${escapeHtml(formatEventSchedule(item))}</span>
        ${locationLine ? `<span>${escapeHtml(locationLine)}</span>` : ''}
      </div>
      ${item.note ? `<p class="card-subtitle">${escapeHtml(item.note)}</p>` : ''}
      ${item.url ? `<div class="card-meta"><a href="${escapeAttribute(item.url)}" target="_blank" rel="noreferrer">Open source</a></div>` : ''}
    </article>
  `;
}

function getFocusedSector() {
  const value = sectorFilter?.value || 'all';
  return value === 'all' ? null : value;
}

function getFilteredEvents(options = {}) {
  const focusedSector = getFocusedSector();
  const events = deriveEvents(options);
  return focusedSector ? events.filter(item => item.sector === focusedSector) : events;
}

function getRenderableEvents() {
  return getFilteredEvents().filter(item => Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng)));
}


function normalizeEventRecord(event) {
  const next = { ...event };
  next.title = String(next.title || '').trim();
  next.organizer = String(next.organizer || '').trim();
  next.priceTier = String(next.priceTier || 'free').trim();
  next.note = String(next.note || '').trim();
  next.url = String(next.url || '').trim();
  next.placeName = String(next.placeName || '').trim();
  next.address = String(next.address || '').trim();
  next.date = String(next.date || '').trim();
  next.startTime = String(next.startTime || '').trim();
  next.endTime = String(next.endTime || '').trim();
  next.scheduleText = String(next.scheduleText || '').trim();
  next.recurringDays = Array.isArray(next.recurringDays) ? next.recurringDays : [];
  return next;
}

function resolveEventEnd(event) {
  if (event.date && event.endTime) return `${event.date}T${event.endTime}`;
  if (event.date && event.startTime) return `${event.date}T${event.startTime}`;
  if (event.date) return `${event.date}T23:59`;
  if (event.recurringDays.length) {
    const startIso = resolveEventStart(event);
    const startDate = new Date(startIso);
    const [endH, endM] = String(event.endTime || event.startTime || '00:00').split(':').map(Number);
    startDate.setHours(Number.isFinite(endH) ? endH : startDate.getHours(), Number.isFinite(endM) ? endM : startDate.getMinutes(), 0, 0);
    return startDate.toISOString();
  }
  return event.createdAt || new Date().toISOString();
}

function isEventExpired(event) {
  const endIso = resolveEventEnd(event);
  return new Date(endIso).getTime() < Date.now();
}

function isEventLive(event) {
  const startIso = resolveEventStart(event);
  const endIso = resolveEventEnd(event);
  const now = Date.now();
  return new Date(startIso).getTime() <= now && new Date(endIso).getTime() >= now;
}

function resolveEventStart(event) {
  if (event.date && event.startTime) return `${event.date}T${event.startTime}`;
  if (event.date) return `${event.date}T00:00`;
  if (event.recurringDays.length) {
    return buildNextRecurringDateTime(event.recurringDays, event.startTime || '00:00');
  }
  return event.createdAt || new Date().toISOString();
}

function buildNextRecurringDateTime(daysOfWeek, timeText) {
  const now = new Date();
  const [h, m] = String(timeText || '00:00').split(':').map(Number);
  for (let offset = 0; offset < 14; offset += 1) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + offset);
    candidate.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0);
    if (daysOfWeek.includes(candidate.getDay()) && candidate >= now) {
      return candidate.toISOString();
    }
  }
  return now.toISOString();
}

function formatEventSchedule(event) {
  if (event.scheduleText) return event.scheduleText;
  if (event.date && event.startTime && event.endTime) return `${formatDate(event.date)} · ${formatTimeText(event.startTime)}–${formatTimeText(event.endTime)}`;
  if (event.date && event.startTime) return `${formatDate(event.date)} · ${formatTimeText(event.startTime)}`;
  if (event.date) return formatDate(event.date);
  if (event.recurringDays.length) return `Recurring · ${event.recurringDays.join(', ')}`;
  return 'Schedule to be announced';
}

function formatTimeText(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const [hoursRaw, minutesRaw] = text.split(':').map(Number);
  if (!Number.isFinite(hoursRaw) || !Number.isFinite(minutesRaw)) return text;
  const period = hoursRaw >= 12 ? 'PM' : 'AM';
  const hours = hoursRaw % 12 || 12;
  return `${hours}:${String(minutesRaw).padStart(2, '0')} ${period}`;
}

function renderResourceCard(item) {
  const scopeLabel = item.groupId
    ? (state.groups.find(group => group.id === item.groupId)?.name || 'Group pin')
    : 'Public map';

  const locationLine = [item.placeName, item.address].filter(Boolean).join(' · ');

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
        ${locationLine ? `<span>${escapeHtml(locationLine)}</span>` : ''}
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

  next.placeName = String(next.placeName || '').trim();
  next.address = String(next.address || '').trim();
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
