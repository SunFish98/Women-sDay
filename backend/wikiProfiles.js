import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { WOMEN_SEED_DATA } from './womenSeedData.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
const DB_PATH = join(DATA_DIR, 'women_profiles.json');

function ensureDb() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(DB_PATH)) writeFileSync(DB_PATH, JSON.stringify({ profiles: [] }, null, 2));
}

function readDb() {
  ensureDb();
  return JSON.parse(readFileSync(DB_PATH, 'utf-8'));
}

function writeDb(data) {
  writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

export async function fetchWikipediaProfile(entry) {
  const encodedTitle = encodeURIComponent(decodeURIComponent(entry.wiki_title));
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodedTitle}`;
  const resp = await fetch(url, { headers: { 'User-Agent': 'womens-day-mentor-app/1.0' } });

  if (!resp.ok) {
    throw new Error(`Wikipedia request failed for ${entry.name}: ${resp.status}`);
  }

  const json = await resp.json();
  return {
    name: entry.name,
    name_en: entry.name_en,
    wiki_title: entry.wiki_title,
    wiki_url: json.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${entry.wiki_title}`,
    summary: json.description || '',
    extract: json.extract || '',
    image_url: json.thumbnail?.source || null,
    updated_at: new Date().toISOString(),
  };
}

export async function syncWikipediaProfiles() {
  const db = readDb();
  const profilesByTitle = new Map(db.profiles.map((item) => [item.wiki_title, item]));
  let success = 0;

  for (const entry of WOMEN_SEED_DATA) {
    try {
      const profile = await fetchWikipediaProfile(entry);
      profilesByTitle.set(entry.wiki_title, profile);
      success += 1;
    } catch (err) {
      console.warn(err.message);
    }
  }

  writeDb({ profiles: Array.from(profilesByTitle.values()) });
  return { total: WOMEN_SEED_DATA.length, success };
}

export function getProfileByName(name) {
  if (!name) return null;
  const normalized = String(name).toLowerCase();
  const { profiles } = readDb();

  return profiles.find((row) => {
    const nameZh = (row.name || '').toLowerCase();
    const nameEn = (row.name_en || '').toLowerCase();
    const combined = `${row.name || ''} ${row.name_en || ''}`.toLowerCase();
    return normalized === nameZh
      || normalized === nameEn
      || normalized === combined
      || normalized.includes(nameZh)
      || normalized.includes(nameEn);
  }) || null;
}

export function getProfileCount() {
  const { profiles } = readDb();
  return profiles.length;
}
