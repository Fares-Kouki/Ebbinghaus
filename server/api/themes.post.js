import fs from 'fs';
import path from 'path';

const THEMES_FILE_PATH = path.join(process.cwd(), 'server/data/themes.json');

export default defineEventHandler(async (event) => {
  try {
    const { action, theme, themeId } = await readBody(event);
    
    console.log(`🎨 [themes.post] Action: ${action}`);
    
    const themesData = loadThemes();
    
    switch (action) {
      case 'add':
        return addTheme(themesData, theme);
        
      case 'update':
        return updateTheme(themesData, theme);
        
      case 'toggle':
        return toggleTheme(themesData, themeId);
        
      case 'delete':
        return deleteTheme(themesData, themeId);
        
      default:
        throw new Error('Action non supportée');
    }
    
  } catch (error) {
    console.error('❌ [themes.post] Erreur:', error);
    
    return {
      statusCode: 400,
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
  
  return {
    themes: [],
    version: "1.0"
  };
}

function saveThemes(themesData) {
  try {
    // Créer le dossier s'il n'existe pas
    const dir = path.dirname(THEMES_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    themesData.last_updated = new Date().toISOString();
    
    fs.writeFileSync(THEMES_FILE_PATH, JSON.stringify(themesData, null, 2));
    console.log(`💾 [saveThemes] ${themesData.themes.length} thèmes sauvegardés`);
    
    return true;
  } catch (error) {
    console.error('❌ [saveThemes] Erreur écriture:', error);
    return false;
  }
}

function addTheme(themesData, newTheme) {
  // Valider le nouveau thème
  if (!newTheme.id || !newTheme.name || !newTheme.prompt_template) {
    throw new Error('Champs requis manquants (id, name, prompt_template)');
  }
  
  // Vérifier que l'ID n'existe pas déjà
  const existingTheme = themesData.themes.find(t => t.id === newTheme.id);
  if (existingTheme) {
    throw new Error(`Le thème ${newTheme.id} existe déjà`);
  }
  
  // Ajouter le nouveau thème
  const theme = {
    id: newTheme.id,
    name: newTheme.name,
    description: newTheme.description || '',
    prompt_template: newTheme.prompt_template,
    active: newTheme.active !== false
  };
  
  themesData.themes.push(theme);
  
  if (saveThemes(themesData)) {
    console.log(`✅ [addTheme] Nouveau thème ajouté: ${theme.name}`);
    return {
      success: true,
      message: `Thème "${theme.name}" ajouté avec succès`,
      theme: theme,
      totalThemes: themesData.themes.length
    };
  }
  
  throw new Error('Erreur lors de la sauvegarde');
}

function updateTheme(themesData, updatedTheme) {
  const index = themesData.themes.findIndex(t => t.id === updatedTheme.id);
  
  if (index === -1) {
    throw new Error(`Thème ${updatedTheme.id} non trouvé`);
  }
  
  // Mettre à jour le thème
  themesData.themes[index] = {
    ...themesData.themes[index],
    ...updatedTheme
  };
  
  if (saveThemes(themesData)) {
    console.log(`✅ [updateTheme] Thème mis à jour: ${updatedTheme.name}`);
    return {
      success: true,
      message: `Thème "${updatedTheme.name}" mis à jour`,
      theme: themesData.themes[index]
    };
  }
  
  throw new Error('Erreur lors de la sauvegarde');
}

function toggleTheme(themesData, themeId) {
  const theme = themesData.themes.find(t => t.id === themeId);
  
  if (!theme) {
    throw new Error(`Thème ${themeId} non trouvé`);
  }
  
  theme.active = !theme.active;
  
  if (saveThemes(themesData)) {
    const status = theme.active ? 'activé' : 'désactivé';
    console.log(`✅ [toggleTheme] Thème ${status}: ${theme.name}`);
    return {
      success: true,
      message: `Thème "${theme.name}" ${status}`,
      theme: theme
    };
  }
  
  throw new Error('Erreur lors de la sauvegarde');
}

function deleteTheme(themesData, themeId) {
  const index = themesData.themes.findIndex(t => t.id === themeId);
  
  if (index === -1) {
    throw new Error(`Thème ${themeId} non trouvé`);
  }
  
  const deletedTheme = themesData.themes.splice(index, 1)[0];
  
  if (saveThemes(themesData)) {
    console.log(`✅ [deleteTheme] Thème supprimé: ${deletedTheme.name}`);
    return {
      success: true,
      message: `Thème "${deletedTheme.name}" supprimé`,
      deletedTheme: deletedTheme,
      totalThemes: themesData.themes.length
    };
  }
  
  throw new Error('Erreur lors de la sauvegarde');
}