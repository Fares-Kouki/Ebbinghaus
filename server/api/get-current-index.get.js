import fs from 'fs';
import path from 'path';

const CACHE_FILE_PATH = path.join(process.cwd(), 'server/data/content-cache.json');

// Date de référence : 8 décembre 2025 = Jour 1
const REFERENCE_DATE = new Date('2025-12-08T00:00:00');

function calculateCurrentDayIndex() {
  const today = new Date();
  // Normaliser à minuit pour le calcul
  today.setHours(0, 0, 0, 0);

  const diffTime = today.getTime() - REFERENCE_DATE.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  // Jour 1 = 8 décembre 2025, donc index = diffDays + 1
  return Math.max(1, diffDays + 1);
}

export default defineEventHandler(async (event) => {
  try {
    const cache = loadCache();
    const currentIndex = calculateCurrentDayIndex();

    return {
      success: true,
      currentIndex: currentIndex,
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
