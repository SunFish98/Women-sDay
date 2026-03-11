import { syncWikipediaProfiles } from './wikiProfiles.js';

const result = await syncWikipediaProfiles();
console.log(`Synced ${result.success}/${result.total} women profiles from Wikipedia.`);
if (result.success < result.total) {
  process.exitCode = 1;
}
