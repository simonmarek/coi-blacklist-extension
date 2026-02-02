// Popup script for ČOI Blacklist Extension

// SVG Icons
const ICONS = {
  loading: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="30 70"/></svg>`,
  safe: `<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>`,
  warning: `<svg viewBox="0 0 24 24"><path d="M12 2L1 21h22L12 2zm0 3.99L19.53 19H4.47L12 5.99zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/></svg>`,
  disabled: `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`
};

document.addEventListener('DOMContentLoaded', async () => {
  const header = document.querySelector('.header');
  const statusCard = document.getElementById('status-card');
  const statusIcon = document.getElementById('status-icon');
  const statusTitle = document.getElementById('status-title');
  const statusDomain = document.getElementById('status-domain');
  const statusReason = document.getElementById('status-reason');
  const enabledToggle = document.getElementById('enabled-toggle');
  const updateBtn = document.getElementById('update-btn');
  const updateBtnText = document.getElementById('update-btn-text');
  const updateTimeEl = document.getElementById('update-time');
  const domainCountEl = document.getElementById('domain-count');
  const optionsLink = document.getElementById('options-link');

  // Normalize domain
  function normalizeDomain(url) {
    try {
      let hostname = new URL(url).hostname.toLowerCase().trim();
      return hostname.replace(/^www\./, '');
    } catch {
      return null;
    }
  }

  // Get current tab
  async function getCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  // Update status display
  function setStatus(type, title, domain = '', reason = '') {
    // Remove all status classes
    statusCard.className = 'status-card';
    statusCard.classList.add(`status-card--${type}`);

    // Set icon
    statusIcon.innerHTML = ICONS[type] || ICONS.loading;

    // Set content
    statusTitle.textContent = title;
    statusDomain.textContent = domain;
    statusDomain.style.display = domain ? 'block' : 'none';
    statusReason.textContent = reason;
    statusReason.style.display = reason ? 'block' : 'none';

    // Toggle danger mode for header and button
    if (type === 'warning') {
      header.classList.add('header--danger');
      updateBtn.classList.add('btn--danger-mode');
    } else {
      header.classList.remove('header--danger');
      updateBtn.classList.remove('btn--danger-mode');
    }
  }

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

  // Load and display status
  async function loadStatus() {
    try {
      const { blacklist, settings } = await chrome.storage.local.get(['blacklist', 'settings']);

      // Update toggle state
      enabledToggle.checked = settings?.enabled !== false;

      // Update metadata
      updateTimeEl.textContent = formatDate(blacklist?.metadata?.lastUpdated);
      domainCountEl.textContent = blacklist?.metadata?.count?.toLocaleString('cs-CZ') || '0';

      // Check if disabled
      if (!settings?.enabled) {
        setStatus('disabled', 'Ochrana vypnuta', '', 'Zapněte ochranu v nastavení');
        return;
      }

      // Get current domain
      const tab = await getCurrentTab();
      if (!tab?.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        setStatus('safe', 'Systémová stránka', '', 'Nelze zkontrolovat');
        return;
      }

      const domain = normalizeDomain(tab.url);
      if (!domain) {
        setStatus('safe', 'Neplatná stránka', '', 'Nelze zkontrolovat');
        return;
      }

      // Check whitelist
      if (settings?.whitelist?.includes(domain)) {
        setStatus('safe', 'Na whitelistu', domain, 'Tento web jste přidali na whitelist');
        return;
      }

      // Check blacklist
      if (blacklist?.domains?.includes(domain)) {
        const details = blacklist.details?.[domain];
        setStatus('warning', 'Rizikový web!', domain, details?.reason || 'Na seznamu ČOI');
      } else {
        setStatus('safe', 'Web je v pořádku', domain, 'Není na seznamu rizikových e-shopů');
      }

    } catch {
      setStatus('loading', 'Chyba', '', 'Nepodařilo se načíst data');
    }
  }

  // Handle toggle change
  enabledToggle.addEventListener('change', async () => {
    const { settings = {} } = await chrome.storage.local.get('settings');
    settings.enabled = enabledToggle.checked;
    await chrome.storage.local.set({ settings });
    await loadStatus();
  });

  // Handle update button
  updateBtn.addEventListener('click', async () => {
    updateBtn.disabled = true;
    updateBtn.classList.add('btn--loading');
    updateBtnText.textContent = 'Aktualizuji...';

    try {
      const result = await chrome.runtime.sendMessage({ action: 'forceUpdate' });

      if (result.success) {
        updateBtnText.textContent = 'Hotovo ✓';
      } else {
        // Check if we still have local data
        const { blacklist } = await chrome.storage.local.get('blacklist');
        if (blacklist?.domains?.length) {
          updateBtnText.textContent = 'Nelze připojit';
        } else {
          updateBtnText.textContent = 'Žádná data';
        }
      }
      await loadStatus();
    } catch {
      updateBtnText.textContent = 'Chyba';
    }

    setTimeout(() => {
      updateBtn.disabled = false;
      updateBtn.classList.remove('btn--loading');
      updateBtnText.textContent = 'Aktualizovat';
    }, 2000);
  });

  // Handle options link
  optionsLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  // Initial load
  await loadStatus();
});
