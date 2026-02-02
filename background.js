// Background service worker for ČOI Blacklist Extension
// Handles data fetching and updates

const REMOTE_BLACKLIST_URL = 'https://raw.githubusercontent.com/simonmarek/coi-blacklist-extension/main/data/blacklist.json';
const LOCAL_BLACKLIST_URL = chrome.runtime.getURL('data/blacklist.json');
const UPDATE_ALARM_NAME = 'updateBlacklist';
const UPDATE_INTERVAL_MINUTES = 60 * 24; // 24 hours

// Initialize extension on install
chrome.runtime.onInstalled.addListener(async () => {
  // Set default settings
  const { settings } = await chrome.storage.local.get('settings');
  if (!settings) {
    await chrome.storage.local.set({
      settings: {
        enabled: true,
        bannerPosition: 'top',
        whitelist: []
      }
    });
  }

  // Load bundled blacklist first
  await loadBundledBlacklist();

  // Then try to fetch remote updates (may fail if repo doesn't exist yet)
  await fetchBlacklist();

  // Set up periodic updates
  chrome.alarms.create(UPDATE_ALARM_NAME, {
    periodInMinutes: UPDATE_INTERVAL_MINUTES
  });
});

// Load bundled blacklist.json from extension
async function loadBundledBlacklist() {
  try {
    const response = await fetch(LOCAL_BLACKLIST_URL);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data.domains || !Array.isArray(data.domains)) {
      throw new Error('Invalid blacklist format');
    }

    // Validate domain entries
    if (!data.domains.every(d => typeof d === 'string' && d.length > 0 && d.length < 256)) {
      throw new Error('Invalid domain entries');
    }

    // Only store if we don't have data yet or bundled is newer
    const { blacklist: existing } = await chrome.storage.local.get('blacklist');
    if (!existing?.domains?.length) {
      await chrome.storage.local.set({
        blacklist: {
          metadata: data.metadata || {
            lastUpdated: new Date().toISOString(),
            source: 'ČOI',
            count: data.domains.length
          },
          domains: data.domains,
          details: data.details || {}
        }
      });
    }

    return { success: true, count: data.domains.length };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Handle periodic updates
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === UPDATE_ALARM_NAME) {
    await fetchBlacklist();
  }
});

// Fetch blacklist from GitHub (remote updates)
async function fetchBlacklist() {
  try {
    const response = await fetch(REMOTE_BLACKLIST_URL, {
      cache: 'no-cache'
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();

    // Validate data structure
    if (!data.domains || !Array.isArray(data.domains)) {
      throw new Error('Invalid blacklist format');
    }

    // Validate domain entries
    if (!data.domains.every(d => typeof d === 'string' && d.length > 0 && d.length < 256)) {
      throw new Error('Invalid domain entries');
    }

    // Store the data
    await chrome.storage.local.set({
      blacklist: {
        metadata: data.metadata || {
          lastUpdated: new Date().toISOString(),
          source: 'ČOI',
          count: data.domains.length
        },
        domains: data.domains,
        details: data.details || {}
      }
    });

    return { success: true, count: data.domains.length };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Only accept messages from extension pages (popup, options)
  const extensionOrigin = chrome.runtime.getURL('');
  if (!sender.url?.startsWith(extensionOrigin)) {
    return false;
  }

  if (message.action === 'forceUpdate') {
    fetchBlacklist().then(sendResponse);
    return true; // Keep channel open for async response
  }

  if (message.action === 'getStatus') {
    chrome.storage.local.get(['blacklist', 'settings']).then((data) => {
      sendResponse({
        blacklist: data.blacklist,
        settings: data.settings
      });
    });
    return true;
  }

  if (message.action === 'checkDomain') {
    checkDomain(message.domain).then(sendResponse);
    return true;
  }
});

// Check if a domain is blacklisted
async function checkDomain(domain) {
  const { blacklist, settings } = await chrome.storage.local.get(['blacklist', 'settings']);

  if (!settings?.enabled) {
    return { isBlacklisted: false, reason: 'disabled' };
  }

  if (!blacklist?.domains) {
    return { isBlacklisted: false, reason: 'no_data' };
  }

  // Check whitelist
  if (settings.whitelist?.includes(domain)) {
    return { isBlacklisted: false, reason: 'whitelisted' };
  }

  // Check blacklist
  const isBlacklisted = blacklist.domains.includes(domain);
  const details = blacklist.details?.[domain];

  return {
    isBlacklisted,
    details: isBlacklisted ? details : null
  };
}
