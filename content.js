// Content script for ČOI Blacklist Extension
// Checks current page against blacklist and shows warning banner

(function() {
  'use strict';

  const DISMISSAL_EXPIRY_DAYS = 7;

  // SVG Icons
  const ICONS = {
    warning: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L1 21h22L12 2zm0 3.99L19.53 19H4.47L12 5.99zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/></svg>`,
    chevron: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>`,
    close: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>`,
    external: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M19 19H5V5h7V3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>`
  };

  // Normalize domain for matching
  function normalizeDomain(url) {
    try {
      let hostname = new URL(url).hostname.toLowerCase().trim();
      return hostname.replace(/^www\./, '');
    } catch {
      return null;
    }
  }

  // Check if dismissal is still valid
  function isDismissalValid(timestamp) {
    if (!timestamp) return false;
    const expiryMs = DISMISSAL_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    return Date.now() - timestamp < expiryMs;
  }

  // Format date for display
  function formatDate(isoDate) {
    if (!isoDate) return null;
    try {
      const date = new Date(isoDate);
      return date.toLocaleDateString('cs-CZ', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch {
      return isoDate;
    }
  }

  // Escape HTML to prevent XSS
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Create and inject warning banner
  function showWarningBanner(domain, details, position) {
    // Check if banner already exists
    if (document.querySelector('.pnn-banner')) {
      return;
    }

    const banner = document.createElement('div');
    banner.className = 'pnn-banner';
    if (position === 'bottom') {
      banner.classList.add('pnn-banner--bottom');
    }

    const reasonText = details?.reason || 'Tento web je na seznamu rizikových e-shopů České obchodní inspekce.';
    const dateAdded = formatDate(details?.dateAdded);

    banner.innerHTML = `
      <div class="pnn-container">
        <div class="pnn-main">
          <div class="pnn-icon">
            ${ICONS.warning}
          </div>
          <div class="pnn-text">
            <span class="pnn-title">Pozor!</span> Tento web (<span class="pnn-domain">${escapeHtml(domain)}</span>) je na seznamu rizikových e-shopů ČOI.
          </div>
          <div class="pnn-actions">
            <button class="pnn-details-btn" aria-expanded="false" aria-controls="pnn-details-panel">
              Více info
              ${ICONS.chevron}
            </button>
            <button class="pnn-dismiss-btn" title="Zavřít varování na 7 dní" aria-label="Zavřít">
              ${ICONS.close}
            </button>
          </div>
        </div>
        <div class="pnn-details" id="pnn-details-panel" data-visible="false">
          <div class="pnn-details-grid">
            <div class="pnn-detail-item">
              <span class="pnn-detail-label">Důvod zařazení</span>
              <span class="pnn-detail-value pnn-detail-value--reason">${escapeHtml(reasonText)}</span>
            </div>
            ${dateAdded ? `
            <div class="pnn-detail-item">
              <span class="pnn-detail-label">Přidáno na seznam</span>
              <span class="pnn-detail-value">${escapeHtml(dateAdded)}</span>
            </div>
            ` : ''}
          </div>
          <a href="https://www.coi.gov.cz/pro-spotrebitele/rizikove-e-shopy/" target="_blank" rel="noopener noreferrer" class="pnn-link">
            Více informací na webu ČOI
            ${ICONS.external}
          </a>
        </div>
      </div>
    `;

    // Add event listeners
    const detailsBtn = banner.querySelector('.pnn-details-btn');
    const detailsPanel = banner.querySelector('.pnn-details');
    const dismissBtn = banner.querySelector('.pnn-dismiss-btn');

    detailsBtn.addEventListener('click', () => {
      const isExpanded = detailsBtn.getAttribute('aria-expanded') === 'true';
      detailsBtn.setAttribute('aria-expanded', !isExpanded);
      detailsPanel.setAttribute('data-visible', !isExpanded);
      detailsBtn.innerHTML = `${isExpanded ? 'Více info' : 'Skrýt'} ${ICONS.chevron}`;
    });

    dismissBtn.addEventListener('click', () => {
      // Store dismissal
      chrome.storage.local.get('dismissals').then(({ dismissals = {} }) => {
        dismissals[domain] = Date.now();
        chrome.storage.local.set({ dismissals });
      });
      // Animate out
      banner.style.animation = position === 'bottom'
        ? 'pnn-slideUp 0.3s ease-out reverse forwards'
        : 'pnn-slideDown 0.3s ease-out reverse forwards';
      setTimeout(() => banner.remove(), 300);
    });

    // Insert banner
    if (document.body) {
      document.body.insertBefore(banner, document.body.firstChild);
    } else {
      // Wait for body if not ready
      const observer = new MutationObserver(() => {
        if (document.body) {
          observer.disconnect();
          document.body.insertBefore(banner, document.body.firstChild);
        }
      });
      observer.observe(document.documentElement, { childList: true });
    }
  }

  // Main check function
  async function checkCurrentPage() {
    const domain = normalizeDomain(window.location.href);
    if (!domain) return;

    try {
      const { blacklist, settings, dismissals = {} } = await chrome.storage.local.get([
        'blacklist',
        'settings',
        'dismissals'
      ]);

      // Check if extension is enabled
      if (!settings?.enabled) return;

      // Check if domain is whitelisted
      if (settings.whitelist?.includes(domain)) return;

      // Check if dismissed recently
      if (isDismissalValid(dismissals[domain])) return;

      // Check blacklist
      if (!blacklist?.domains?.includes(domain)) return;

      // Show warning
      const details = blacklist.details?.[domain];
      const position = settings.bannerPosition || 'top';

      // Wait for DOM to be ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          showWarningBanner(domain, details, position);
        });
      } else {
        showWarningBanner(domain, details, position);
      }

    } catch {
      // Silently fail - don't disrupt user's browsing
    }
  }

  // Run check
  checkCurrentPage();
})();
