// Options page script for ČOI Blacklist Extension

document.addEventListener('DOMContentLoaded', async () => {
  const enabledCheckbox = document.getElementById('enabled');
  const bannerPositionSelect = document.getElementById('banner-position');
  const whitelistTextarea = document.getElementById('whitelist');
  const lastUpdateEl = document.getElementById('last-update');
  const domainCountEl = document.getElementById('domain-count');
  const updateBtn = document.getElementById('update-btn');
  const updateBtnText = document.getElementById('update-btn-text');
  const saveBtn = document.getElementById('save-btn');
  const saveStatusEl = document.getElementById('save-status');

  // Format date
  function formatDate(isoString) {
    if (!isoString) return '—';
    try {
      return new Date(isoString).toLocaleString('cs-CZ', {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '—';
    }
  }

  // Normalize domain
  function normalizeDomain(domain) {
    return domain.toLowerCase().replace(/^www\./, '').trim();
  }

  // Show save status
  function showSaveStatus(message, isError = false) {
    saveStatusEl.innerHTML = isError
      ? `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>${message}`
      : `<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>${message}`;
    saveStatusEl.style.color = isError ? '#dc2626' : '#10b981';

    setTimeout(() => {
      saveStatusEl.innerHTML = '';
    }, 3000);
  }

  // Load settings
  async function loadSettings() {
    const { settings, blacklist } = await chrome.storage.local.get(['settings', 'blacklist']);

    // Apply settings
    enabledCheckbox.checked = settings?.enabled !== false;
    bannerPositionSelect.value = settings?.bannerPosition || 'top';
    whitelistTextarea.value = (settings?.whitelist || []).join('\n');

    // Update data info
    lastUpdateEl.textContent = formatDate(blacklist?.metadata?.lastUpdated);
    domainCountEl.textContent = blacklist?.metadata?.count?.toLocaleString('cs-CZ') || '0';
  }

  // Save settings
  async function saveSettings() {
    // Parse whitelist
    const whitelistLines = whitelistTextarea.value
      .split('\n')
      .map(line => normalizeDomain(line))
      .filter(line => line.length > 0);

    const settings = {
      enabled: enabledCheckbox.checked,
      bannerPosition: bannerPositionSelect.value,
      whitelist: whitelistLines
    };

    await chrome.storage.local.set({ settings });
    showSaveStatus('Nastavení uloženo');
  }

  // Handle save button
  saveBtn.addEventListener('click', saveSettings);

  // Handle update button
  updateBtn.addEventListener('click', async () => {
    updateBtn.disabled = true;
    updateBtnText.textContent = 'Aktualizuji...';

    try {
      const result = await chrome.runtime.sendMessage({ action: 'forceUpdate' });

      if (result.success) {
        updateBtnText.textContent = 'Hotovo ✓';
        await loadSettings();
      } else {
        const { blacklist } = await chrome.storage.local.get('blacklist');
        if (blacklist?.domains?.length) {
          updateBtnText.textContent = 'Nelze připojit';
        } else {
          updateBtnText.textContent = 'Žádná data';
        }
      }
    } catch {
      updateBtnText.textContent = 'Chyba';
    }

    setTimeout(() => {
      updateBtn.disabled = false;
      updateBtnText.textContent = 'Aktualizovat';
    }, 2000);
  });

  // Initial load
  await loadSettings();
});
