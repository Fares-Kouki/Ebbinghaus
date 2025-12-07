import fs from 'fs';
import path from 'path';

const CACHE_FILE_PATH = path.join(process.cwd(), 'server/data/content-cache.json');

export default defineEventHandler(async (event) => {
  try {
    const cache = loadCache();

    return {
      success: true,
      currentIndex: cache.current_index || 1,
      totalDays: Object.keys(cache.cache || {}).length
    };
  } catch (error) {
    console.error('❌ [get-current-index] Erreur:', error);
    return {
      success: false,
      currentIndex: 1,
      error: error.message
    };
  }
});

function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE_PATH)) {
      const data = fs.readFileSync(CACHE_FILE_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('❌ [loadCache] Erreur lecture cache:', error);
  }
  return { cache: {}, current_index: 1 };
}
