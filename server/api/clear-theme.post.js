import fs from 'fs';
import path from 'path';

const CACHE_FILE_PATH = path.join(process.cwd(), 'server/data/content-cache.json');

export default defineEventHandler(async (event) => {
  try {
    const { dayIndex, themeId } = await readBody(event);
    
    if (typeof dayIndex !== 'number' || !themeId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'dayIndex (number) et themeId (string) requis'
      });
    }

    console.log(`🗑️ [clear-theme] Suppression du thème ${themeId} pour le jour ${dayIndex}`);

    // Charger le cache
    const cache = loadCache();
    
    // Vérifier si le jour existe
    if (!cache[dayIndex]) {
      return {
        success: false,
        message: `Aucun contenu trouvé pour le jour ${dayIndex}`
      };
    }
    
    // Vérifier si le thème existe pour ce jour
    if (!cache[dayIndex][themeId]) {
      return {
        success: false,
        message: `Thème ${themeId} non trouvé pour le jour ${dayIndex}`
      };
    }
    
    // Supprimer le thème spécifique
    delete cache[dayIndex][themeId];
    
    // Supprimer complètement le jour si plus de thèmes
    if (Object.keys(cache[dayIndex]).length === 0) {
      delete cache[dayIndex];
    }
    
    // Sauvegarder le cache
    saveCache(cache);
    
    return {
      success: true,
      message: `Thème ${themeId} supprimé pour le jour ${dayIndex}`,
      remainingThemes: cache[dayIndex] ? Object.keys(cache[dayIndex]).length : 0
    };

  } catch (error) {
    console.error('❌ [clear-theme] Erreur:', error);
    
    return {
      statusCode: 500,
      success: false,
      error: error.message
    };
  }
});

function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE_PATH)) {
      const data = fs.readFileSync(CACHE_FILE_PATH, 'utf8');
      const parsed = JSON.parse(data);
      return parsed.cache || {};
    }
  } catch (error) {
    console.error('❌ [loadCache] Erreur lecture cache:', error);
  }
  return {};
}

function saveCache(cache) {
  try {
    // Créer le dossier s'il n'existe pas
    const dir = path.dirname(CACHE_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const data = {
      cache,
      last_updated: new Date().toISOString(),
      version: "1.0"
    };
    
    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(data, null, 2));
    console.log(`💾 [saveCache] Cache sauvegardé`);
  } catch (error) {
    console.error('❌ [saveCache] Erreur écriture cache:', error);
  }
}