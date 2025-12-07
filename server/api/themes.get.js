import fs from 'fs';
import path from 'path';

const THEMES_FILE_PATH = path.join(process.cwd(), 'server/data/themes.json');

export default defineEventHandler(async (event) => {
  try {
    console.log('📋 [themes.get] Récupération des thèmes');
    
    const themes = loadThemes();
    
    return {
      success: true,
      themes: themes.themes || [],
      activeThemes: themes.themes.filter(t => t.active),
      totalThemes: themes.themes.length,
      version: themes.version
    };
    
  } catch (error) {
    console.error('❌ [themes.get] Erreur:', error);
    
    return {
      statusCode: 500,
      success: false,
      error: error.message
    };
  }
});

function loadThemes() {
  try {
    if (fs.existsSync(THEMES_FILE_PATH)) {
      const data = fs.readFileSync(THEMES_FILE_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('❌ [loadThemes] Erreur lecture:', error);
  }
  
  // Retourner des thèmes par défaut si le fichier n'existe pas
  return {
    themes: [],
    version: "1.0"
  };
}