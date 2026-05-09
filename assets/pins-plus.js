(() => {
  const STORAGE_KEYS = ['groundwork-okc-v2', 'groundwork-okc-v1'];
  const ACTIVE_STORAGE_KEY = 'groundwork-okc-v2';

  const resourceForm = document.getElementById('resourceForm');
  const resourceList = document.getElementById('resourceList');
  const resourceFilter = document.getElementById('resourceFilter');
  const sectorFilter = document.getElementById('sectorFilter');
  const scopeFilter = document.getElementById('scopeFilter');

  if (!resourceForm || !resourceList) return;

  resourceForm.addEventListener('submit', handleResourceSubmitEnhancement);
  resourceList.addEventListener('click', handleScorecardClick);
  resourceList.addEventListener('change', handleScorecardChange);

  [resourceFilter, sectorFilter, scopeFilter]
    .filter(Boolean)
    .forEach(control => control.addEventListener('change', () => queueMicrotask(decorateResourceCards)));

  const observer = new MutationObserver(() => decorateResourceCards());
  observer.observe(resourceList, { childList: true, subtree: true });

  queueMicrotask(decorateResourceCards);

  function handleResourceSubmitEnhancement() {
    const accessibility = {
      adaStatus: normalizeValue(resourceForm.adaStatus?.value, 'unknown'),
      wheelchairAccess: normalizeValue(resourceForm.wheelchairAccess?.value, 'unknown'),
      pathSurface: normalizeValue(resourceForm.pathSurface?.value, 'unknown'),
    };

    queueMicrotask(() => {
      const state = loadState();
      const targetEvent = [...(state.events || [])].reverse().find(event => event.kind === 'resource.pin.add');
      if (!targetEvent) return;

      targetEvent.payload = ensureScorecardDefaults(targetEvent.payload);
      targetEvent.payload.accessibility = accessibility;
      persistState(state);
      decorateResourceCards();
    });
  }

  function handleScorecardClick(event) {
    const actionButton = event.target.closest('[data-pin-action]');
    if (!actionButton) return;

    const resourceId = actionButton.dataset.resourceId;
    const action = actionButton.dataset.pinAction;
    if (!resourceId || !action) return;

    if (action === 'confirm') {
      mutateResource(resourceId, (payload, state) => {
        const now = new Date().toISOString();
        payload = ensureScorecardDefaults(payload);
        payload.confirmations.push({
          at: now,
          alias: state.identity?.alias || 'Local user',
        });
        payload.lastVerifiedAt = now;
        return true;
      });
      return;
    }

    if (action === 'rate') {
      const value = window.prompt('Rate this pin from 1 to 5.');
      const score = Number(value);
      if (!Number.isInteger(score) || score < 1 || score > 5) return;
      mutateResource(resourceId, (payload, state) => {
        payload = ensureScorecardDefaults(payload);
        payload.ratings.push({
          score,
          at: new Date().toISOString(),
          alias: state.identity?.alias || 'Local user',
        });
        return true;
      });
      return;
    }

    if (action === 'note') {
      const body = window.prompt('Add a short note or confirmation detail.');
      if (!body || !body.trim()) return;
      mutateResource(resourceId, (payload, state) => {
        payload = ensureScorecardDefaults(payload);
        payload.comments.push({
          body: body.trim().slice(0, 280),
          at: new Date().toISOString(),
          alias: state.identity?.alias || 'Local user',
        });
        return true;
      });
      return;
    }

    if (action === 'photo') {
      const input = resourceList.querySelector(`[data-photo-input="${cssEscape(resourceId)}"]`);
      input?.click();
    }
  }

  async function handleScorecardChange(event) {
    const input = event.target.closest('[data-photo-input]');
    if (!input || !input
