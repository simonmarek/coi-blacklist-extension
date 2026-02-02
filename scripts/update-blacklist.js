#!/usr/bin/env node

// Script to fetch ČOI blacklist from their website and convert to JSON
// Run: node scripts/update-blacklist.js

const https = require('https');
const fs = require('fs');
const path = require('path');

const PAGE_URL = 'https://coi.gov.cz/pro-spotrebitele/rizikove-e-shopy/';
const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'blacklist.json');

// Fetch URL and return text
function fetch(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      // Handle redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        const redirectUrl = response.headers.location.startsWith('http')
          ? response.headers.location
          : new URL(response.headers.location, url).href;
        return fetch(redirectUrl).then(resolve).catch(reject);
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }

      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(buffer.toString('utf8'));
      });
      response.on('error', reject);
    });

    request.on('error', reject);
    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

// Normalize domain
function normalizeDomain(domain) {
  if (!domain) return null;
  let normalized = domain.toLowerCase().trim();
  // Remove protocol if present
  normalized = normalized.replace(/^https?:\/\//, '');
  // Remove www prefix
  normalized = normalized.replace(/^www\./, '');
  // Remove trailing slash and path
  normalized = normalized.split('/')[0];
  // Remove port if present
  normalized = normalized.split(':')[0];
  // Basic validation - must have at least one dot
  if (!normalized.includes('.')) return null;
  // Remove any remaining whitespace or invalid chars
  normalized = normalized.replace(/\s+/g, '');
  return normalized || null;
}

// Parse Czech date format (DD. MM. YYYY) to ISO
function parseCzechDate(dateStr) {
  if (!dateStr) return null;
  const match = dateStr.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/);
  if (!match) return null;
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

// Decode HTML entities
function decodeEntities(text) {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(code));
}

// Strip HTML tags
function stripTags(html) {
  return html.replace(/<[^>]+>/g, '').trim();
}

// Parse entries from HTML
function parseEntries(html) {
  const domains = [];
  const details = {};

  // Find all article elements with class "information-row"
  const articleRegex = /<article[^>]*class="[^"]*information-row[^"]*"[^>]*>([\s\S]*?)<\/article>/gi;
  let articleMatch;

  while ((articleMatch = articleRegex.exec(html)) !== null) {
    const articleHtml = articleMatch[1];

    // Extract domain from <span> inside list_titles
    const domainMatch = articleHtml.match(/<p[^>]*class\s*=\s*["'][^"]*list_titles[^"]*["'][^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i);
    if (!domainMatch) continue;

    const rawDomain = stripTags(domainMatch[1]);
    const domain = normalizeDomain(rawDomain);
    if (!domain) continue;

    // Extract date (DD. MM. YYYY)
    const dateMatch = articleHtml.match(/\((\d{1,2}\.\s*\d{1,2}\.\s*\d{4})\)/);
    const dateAdded = dateMatch ? parseCzechDate(dateMatch[1]) : null;

    // Extract reason - get all <p> tags content except the title and date
    const paragraphs = articleHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
    let reason = '';

    for (const p of paragraphs) {
      // Skip the title paragraph and separator
      if (p.includes('list_titles') || /[—–-]{3,}/.test(p)) continue;

      const text = decodeEntities(stripTags(p)).trim();
      // Skip date-only paragraphs
      if (/^\(\d{1,2}\.\s*\d{1,2}\.\s*\d{4}\)$/.test(text)) continue;
      // Skip empty
      if (!text) continue;

      if (reason) reason += ' ';
      reason += text;
    }

    // Clean up reason - remove the date if it's at the end
    reason = reason.replace(/\(\d{1,2}\.\s*\d{1,2}\.\s*\d{4}\)\s*$/, '').trim();
    if (!reason) reason = 'Na seznamu rizikových e-shopů ČOI';

    // Avoid duplicates
    if (domains.includes(domain)) continue;

    domains.push(domain);
    details[domain] = {
      reason: reason.substring(0, 500),
      dateAdded
    };
  }

  return { domains, details };
}

async function main() {
  console.log('Fetching ČOI blacklist from website...');
  console.log('URL:', PAGE_URL);

  try {
    // Fetch HTML
    const html = await fetch(PAGE_URL);
    console.log(`Downloaded ${html.length} bytes`);

    // Parse entries directly from HTML
    const { domains, details } = parseEntries(html);
    console.log(`Parsed ${domains.length} domains`);

    if (domains.length === 0) {
      throw new Error('No domains parsed - page structure may have changed');
    }

    // Create output
    const output = {
      metadata: {
        lastUpdated: new Date().toISOString(),
        source: 'ČOI',
        sourceUrl: PAGE_URL,
        count: domains.length
      },
      domains,
      details
    };

    // Ensure output directory exists
    const outputDir = path.dirname(OUTPUT_PATH);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write JSON
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf8');
    console.log(`Written to ${OUTPUT_PATH}`);

    // Print sample
    console.log('\nSample domains:');
    domains.slice(0, 5).forEach(d => {
      const info = details[d];
      console.log(`  - ${d} (${info.dateAdded || 'no date'})`);
    });
    if (domains.length > 5) {
      console.log(`  ... and ${domains.length - 5} more`);
    }

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
