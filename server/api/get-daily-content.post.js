import fs from 'fs';
import path from 'path';

const CACHE_FILE_PATH = path.join(process.cwd(), 'server/data/content-cache.json');
const THEMES_FILE_PATH = path.join(process.cwd(), 'server/data/themes.json');

export default defineEventHandler(async (event) => {
  try {
    const { dayIndex } = await readBody(event);

    if (typeof dayIndex !== 'number') {
      throw createError({
        statusCode: 400,
        statusMessage: 'dayIndex requis et doit être un nombre'
      });
    }

    console.log(`📅 [get-daily-content] Demande pour l'index: ${dayIndex}`);

    // Charger le cache complet
    const cacheData = loadCacheData();
    const cache = cacheData.cache || {};

    // Charger les thèmes actifs
    const themes = loadThemes();
    const activeThemes = themes.themes.filter(t => t.active);

    // Vérifier si on a déjà des données pour ce jour
    if (cache[dayIndex]) {
      const missingOrIncomplete = getMissingOrIncompleteThemes(cache[dayIndex], activeThemes);

      if (missingOrIncomplete.length === 0) {
        console.log(`🎯 [get-daily-content] Données complètes trouvées dans le cache pour l'index ${dayIndex}`);
        return {
          dayIndex,
          content: cache[dayIndex],
          source: 'cache'
        };
      } else {
        console.log(`📝 [get-daily-content] Thèmes manquants/incomplets: ${missingOrIncomplete.map(t => t.name).join(', ')}`);

        const missingContent = await generateMissingContent(dayIndex, cache, missingOrIncomplete);
        const updatedContent = { ...cache[dayIndex], ...missingContent };
        cache[dayIndex] = updatedContent;
        saveCacheData({ ...cacheData, cache, current_index: Math.max(cacheData.current_index || 1, dayIndex) });

        return {
          dayIndex,
          content: updatedContent,
          source: 'partial_update'
        };
      }
    }

    console.log(`🔄 [get-daily-content] Génération de nouveau contenu pour l'index ${dayIndex}`);

    // Générer nouveau contenu
    const newContent = await generateDailyContent(dayIndex, cache, activeThemes);

    // Sauvegarder dans le cache et mettre à jour l'index courant
    cache[dayIndex] = newContent;
    saveCacheData({
      ...cacheData,
      cache,
      current_index: Math.max(cacheData.current_index || 1, dayIndex),
      last_updated: new Date().toISOString()
    });

    return {
      dayIndex,
      content: newContent,
      source: 'claude'
    };

  } catch (error) {
    console.error('❌ [get-daily-content] Erreur:', error);

    return {
      statusCode: 500,
      error: error.message,
      fallback: getFallbackContent()
    };
  }
});

function loadCacheData() {
  try {
    if (fs.existsSync(CACHE_FILE_PATH)) {
      const data = fs.readFileSync(CACHE_FILE_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('❌ [loadCacheData] Erreur lecture cache:', error);
  }
  return { cache: {}, current_index: 1, version: "2.0" };
}

function loadCache() {
  return loadCacheData().cache || {};
}

function saveCacheData(data) {
  try {
    const dir = path.dirname(CACHE_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const saveData = {
      ...data,
      last_updated: new Date().toISOString(),
      version: "2.0"
    };

    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(saveData, null, 2));
    console.log(`💾 [saveCacheData] Cache sauvegardé avec ${Object.keys(data.cache || {}).length} entrées, index courant: ${data.current_index}`);
  } catch (error) {
    console.error('❌ [saveCacheData] Erreur écriture cache:', error);
  }
}

function loadThemes() {
  try {
    if (fs.existsSync(THEMES_FILE_PATH)) {
      const data = fs.readFileSync(THEMES_FILE_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('❌ [loadThemes] Erreur lecture thèmes:', error);
  }

  return {
    themes: [
      {
        id: "world_history",
        name: "🌍 Histoire Mondiale",
        description: "Événements historiques majeurs du monde",
        active: true
      }
    ],
    version: "1.0"
  };
}

function getMissingOrIncompleteThemes(cachedContent, activeThemes) {
  const missingThemes = [];

  for (const theme of activeThemes) {
    const content = cachedContent[theme.id];

    if (!content) {
      missingThemes.push(theme);
      continue;
    }

    const requiredFields = ['title', 'date', 'description', 'importance', 'question', 'answer'];
    const isIncomplete = requiredFields.some(field => !content[field] || content[field].trim() === '');

    if (isIncomplete) {
      missingThemes.push(theme);
    }
  }

  return missingThemes;
}

async function generateMissingContent(dayIndex, existingCache, missingThemes) {
  console.log(`🔄 [generateMissingContent] Génération pour ${missingThemes.length} thèmes manquants`);

  const previousContent = getAllPreviousContent(existingCache);
  const groupedPrompt = createChronologicalPrompt(missingThemes, previousContent, dayIndex);

  try {
    const response = await callClaudeAPI(groupedPrompt);
    const parsedContent = parseGroupedResponse(response, missingThemes);
    return parsedContent;
  } catch (error) {
    console.error('❌ [generateMissingContent] Erreur API:', error);
    throw error;
  }
}

async function generateDailyContent(dayIndex, existingCache, activeThemes) {
  if (activeThemes.length === 0) {
    throw new Error('Aucun thème actif trouvé');
  }

  console.log(`🎨 [generateDailyContent] ${activeThemes.length} thèmes actifs`);

  const previousContent = getAllPreviousContent(existingCache);
  const groupedPrompt = createChronologicalPrompt(activeThemes, previousContent, dayIndex);

  try {
    const response = await callClaudeAPI(groupedPrompt);
    const parsedContent = parseGroupedResponse(response, activeThemes);
    return parsedContent;
  } catch (error) {
    console.error('❌ [generateDailyContent] Erreur API:', error);
    throw error;
  }
}

function getAllPreviousContent(cache) {
  const content = {
    titles: [],
    byTheme: {}
  };

  // Trier les index pour avoir l'ordre chronologique
  const sortedIndexes = Object.keys(cache).map(Number).sort((a, b) => a - b);

  sortedIndexes.forEach(index => {
    const dayContent = cache[index];
    if (dayContent && typeof dayContent === 'object') {
      Object.entries(dayContent).forEach(([themeId, item]) => {
        if (item && item.title) {
          content.titles.push(item.title);

          if (!content.byTheme[themeId]) {
            content.byTheme[themeId] = [];
          }
          content.byTheme[themeId].push({
            index,
            title: item.title,
            date: item.date
          });
        }
      });
    }
  });

  return content;
}

function getLastDateForTheme(themeId, previousContent) {
  const themeContent = previousContent.byTheme[themeId];
  if (!themeContent || themeContent.length === 0) {
    return null;
  }
  // Retourner le dernier élément (le plus récent)
  return themeContent[themeContent.length - 1];
}

function createChronologicalPrompt(activeThemes, previousContent, dayIndex) {
  const avoidList = previousContent.titles.length > 0
    ? `\n\nTITRES DÉJÀ UTILISÉS (À NE PAS RÉPÉTER):\n${previousContent.titles.map(t => `- ${t}`).join('\n')}\n`
    : '';

  let prompt = `Tu es un expert en histoire et culture générale. Génère du contenu éducatif pour le JOUR ${dayIndex} d'un programme d'apprentissage.

RÈGLE FONDAMENTALE: Chaque thème doit progresser CHRONOLOGIQUEMENT depuis le début de son histoire.
${avoidList}

IMPORTANT:
- Chaque contenu doit être UNIQUE et JAMAIS répété
- Respecte strictement l'ordre chronologique pour chaque thème
- Pour les Prix Nobel: commence en 1901 et avance année par année
- Pour l'histoire: progresse de manière chronologique depuis les débuts

Pour CHAQUE catégorie, réponds au format EXACT (sans markdown, sans **) :

`;

  activeThemes.forEach(theme => {
    const lastContent = getLastDateForTheme(theme.id, previousContent);
    const chronoInstruction = getChronologicalInstruction(theme.id, lastContent, dayIndex);

    prompt += `===CATEGORY:${theme.id}===
${chronoInstruction}
Titre: [titre court et précis]
Date: [date précise: jour mois année, ou "année" si jour inconnu]
Description: [description de 2-3 phrases]
Importance: [pourquoi c'est important en 1 phrase]
Question: [une question de quiz sur ce sujet]
Reponse: [réponse courte à la question]

`;
  });

  prompt += `CRUCIAL:
- Chaque titre DOIT être DIFFÉRENT de ceux déjà utilisés
- Respecte l'ordre CHRONOLOGIQUE strict pour chaque thème
- Pas de markdown, pas de **`;

  return prompt;
}

function getChronologicalInstruction(themeId, lastContent, dayIndex) {
  const themeInstructions = {
    'nobel_prizes_physic': {
      start: 'Commence avec le Prix Nobel de Physique 1901 (Wilhelm Röntgen)',
      next: (last) => `Continue avec le Prix Nobel de Physique suivant après ${last?.date || '1901'}. Progresse année par année.`,
      questionFormat: 'La question DOIT être: "Le nom et la nationalité du Prix Nobel de Physique de [ANNÉE] ?" et la réponse doit être "[Prénom Nom], [nationalité]"'
    },
    'nobel_prizes_chemistry': {
      start: 'Commence avec le Prix Nobel de Chimie 1901 (Jacobus van \'t Hoff)',
      next: (last) => `Continue avec le Prix Nobel de Chimie suivant après ${last?.date || '1901'}. Progresse année par année.`,
      questionFormat: 'La question DOIT être: "Le nom et la nationalité du Prix Nobel de Chimie de [ANNÉE] ?" et la réponse doit être "[Prénom Nom], [nationalité]"'
    },
    'nobel_prizes_peace': {
      start: 'Commence avec le Prix Nobel de la Paix 1901 (Henry Dunant et Frédéric Passy)',
      next: (last) => `Continue avec le Prix Nobel de la Paix suivant après ${last?.date || '1901'}. Progresse année par année.`,
      questionFormat: 'La question DOIT être: "Le nom et la nationalité du Prix Nobel de la Paix de [ANNÉE] ?" et la réponse doit être "[Prénom Nom], [nationalité]" (ou plusieurs noms si prix partagé)'
    },
    'nobel_prizes_literature': {
      start: 'Commence avec le Prix Nobel de Littérature 1901 (Sully Prudhomme)',
      next: (last) => `Continue avec le Prix Nobel de Littérature suivant après ${last?.date || '1901'}. Progresse année par année.`,
      questionFormat: 'La question DOIT être: "Le nom et la nationalité du Prix Nobel de Littérature de [ANNÉE] ?" et la réponse doit être "[Prénom Nom], [nationalité]"'
    },
    'world_history': {
      start: 'Commence avec les premiers événements de l\'histoire humaine (préhistoire, premières civilisations)',
      next: (last) => `Continue chronologiquement après ${last?.date || 'le début de l\'histoire'}. Avance dans le temps.`
    },
    'france_history': {
      start: 'Commence avec les premiers habitants de la Gaule (préhistoire, Celtes)',
      next: (last) => `Continue l'histoire de France chronologiquement après ${last?.date || 'les origines'}.`
    },
    'egypt_history': {
      start: 'Commence avec l\'Égypte prédynastique et les premières dynasties de pharaons',
      next: (last) => `Continue l'histoire de l'Égypte chronologiquement après ${last?.date || 'les origines'}.`
    },
    'rome_history': {
      start: 'Commence avec la fondation mythique de Rome (753 av. J.-C.) ou la période royale',
      next: (last) => `Continue l'histoire de Rome chronologiquement après ${last?.date || 'la fondation'}.`
    },
    'cinema': {
      start: 'Commence avec l\'invention du cinéma (frères Lumière, 1895)',
      next: (last) => `Continue l'histoire du cinéma chronologiquement après ${last?.date || '1895'}.`
    },
    'literature': {
      start: 'Commence avec les premiers textes littéraires (épopée de Gilgamesh, littérature antique)',
      next: (last) => `Continue l'histoire de la littérature chronologiquement après ${last?.date || 'l\'antiquité'}.`
    },
    'music': {
      start: 'Commence avec les origines de la musique occidentale (chant grégorien, musique médiévale)',
      next: (last) => `Continue l'histoire de la musique chronologiquement après ${last?.date || 'le Moyen Âge'}.`
    },
    'decouvertes_scientifiques': {
      start: 'Commence avec les premières découvertes scientifiques (Antiquité: Archimède, Euclide...)',
      next: (last) => `Continue les découvertes scientifiques chronologiquement après ${last?.date || 'l\'antiquité'}.`
    },
    'countries_capitals': {
      start: 'Présente un pays et sa capitale (commence par ordre alphabétique: Afghanistan)',
      next: (last) => `Continue avec le pays suivant dans l'ordre alphabétique après ${last?.title?.split(' ')[0] || 'A'}.`
    }
  };

  const instruction = themeInstructions[themeId];
  if (!instruction) {
    if (lastContent) {
      return `Continue chronologiquement après: "${lastContent.title}" (${lastContent.date})`;
    }
    return 'Commence par le début chronologique de ce thème';
  }

  if (!lastContent) {
    let result = instruction.start;
    if (instruction.questionFormat) {
      result += '\n' + instruction.questionFormat;
    }
    return result;
  }

  let result = instruction.next(lastContent);
  if (instruction.questionFormat) {
    result += '\n' + instruction.questionFormat;
  }
  return result;
}

async function callClaudeAPI(prompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY

  const response = await $fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: {
      model: "claude-sonnet-4-5",
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    }
  });

  if (!response.content || !response.content[0]) {
    throw new Error('Réponse API Claude invalide');
  }

  return response.content[0].text;
}

function parseGroupedResponse(content, categories) {
  const result = {};

  const sections = content.split('===CATEGORY:').slice(1);

  sections.forEach(section => {
    try {
      const lines = section.split('\n').filter(line => line.trim());
      if (lines.length === 0) return;

      const categoryMatch = lines[0].match(/([^=]+)===/);
      if (!categoryMatch) return;

      const category = categoryMatch[1].trim();

      const item = {
        title: extractField(section, 'Titre'),
        date: extractField(section, 'Date'),
        description: extractField(section, 'Description'),
        importance: extractField(section, 'Importance'),
        question: extractField(section, 'Question'),
        answer: extractField(section, 'Reponse'),
        source: 'Claude'
      };

      if (item.title && item.title.trim() !== '') {
        result[category] = item;
        console.log(`✅ [parseGroupedResponse] ${category}: ${item.title}`);
      }

    } catch (error) {
      console.error(`❌ [parseGroupedResponse] Erreur parsing section:`, error);
    }
  });

  return result;
}

function extractField(text, field) {
  const regex = new RegExp(`${field}:\\s*(.+?)(?=\\n[A-Za-zÀ-ÿ]+:|===|$)`, 's');
  const match = text.match(regex);

  if (match) {
    let result = match[1].trim();
    result = result.replace(/\n+$/, '');
    // Nettoyer les crochets si présents
    result = result.replace(/^\[|\]$/g, '');
    return result.trim();
  }

  return '';
}

function getFallbackContent() {
  return {
    world_history: {
      title: "Contenu en cours de chargement",
      date: "Date inconnue",
      description: "Le contenu est en cours de génération...",
      importance: "Veuillez patienter",
      question: "Chargement en cours ?",
      answer: "Patience...",
      source: 'fallback'
    }
  };
}
