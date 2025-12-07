export default defineEventHandler(async (event) => {
  try {
    const { prompt, uniqueKey } = await readBody(event);
    
    if (!prompt) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Prompt requis'
      });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    
    const response = await $fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: {
        model: "claude-sonnet-4-5",
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: `Tu es un expert en histoire et culture générale. Réponds toujours au format exact demandé avec des informations précises et vérifiées.

RESPECTE STRICTEMENT le format suivant :
Titre: [titre court et précis]
Date: [date précise]
Description: [description de 2-3 phrases maximum]
Importance: [pourquoi c'est important en 1 phrase]

Voici la demande : ${prompt}`
          }
        ]
      }
    });

    if (!response.content || !response.content[0]) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Réponse API Claude invalide'
      });
    }

    const content = response.content[0].text;
    console.log('Réponse Claude:', content);
    
    // Parser la réponse
    const parsed = parseAIResponse(content, uniqueKey);
    console.log('Contenu parsé:', parsed);
    
    return parsed;

  } catch (error) {
    console.error('Erreur API Claude:', error);
    
    // Fallback vers contenu généré
    return {
      title: `Information ${Date.now()}`,
      date: new Date().toLocaleDateString('fr-FR'),
      description: `Information générée en fallback pour éviter les erreurs. Clé unique: ${uniqueKey || 'inconnue'}`,
      importance: "Information de fallback en cas d'erreur API.",
      source: 'fallback'
    };
  }
});

function parseAIResponse(content, uniqueKey = 'default') {
  console.log('Parsing content:', content);
  console.log('UniqueKey:', uniqueKey);
  
  if (!content) {
    return {
      title: 'Erreur de contenu',
      date: 'Date inconnue',
      description: 'Aucun contenu reçu de l\'API',
      importance: 'Information manquante',
      source: 'Claude'
    };
  }
  
  const lines = content.split('\n').map(line => line.trim()).filter(line => line);
  const result = {
    title: 'Information historique',
    date: 'Date inconnue',
    description: 'Information générée',
    importance: 'Important pour la culture générale',
    source: 'Claude'
  };

  lines.forEach(line => {
    if (line.toLowerCase().startsWith('titre:')) {
      result.title = line.replace(/titre:\s*/i, '').trim();
    } else if (line.toLowerCase().startsWith('date:')) {
      result.date = line.replace(/date:\s*/i, '').trim();
    } else if (line.toLowerCase().startsWith('description:')) {
      result.description = line.replace(/description:\s*/i, '').trim();
    } else if (line.toLowerCase().startsWith('importance:')) {
      result.importance = line.replace(/importance:\s*/i, '').trim();
    }
  });

  // Si le parsing a échoué, utiliser tout le contenu comme description
  if (result.title === 'Information historique' && content.length > 10) {
    result.description = content.substring(0, 200) + '...';
    result.title = 'Information Claude';
  }

  return result;
}