import axios from 'axios';

export class ContentFetcher {
  constructor() {
    this.baseHistoricalYear = 0; 
    this.apiEndpoints = {
      claude: 'https://api.anthropic.com/v1/messages',
      restCountries: 'https://restcountries.com/v3.1/all'
    };
    this.apiKey = process.env.ANTHROPIC_API_KEY
    this.usedContent = new Set();
    this.dailyContentCache = null; // Cache pour éviter les appels multiples
  }

  async getHistoricalInfo(category, dayIndex) {
    console.log(`📋 [getHistoricalInfo] Demande: ${category} pour index ${dayIndex}`);
    
    try {
      // Obtenir tout le contenu du jour en une fois
      const dailyContent = await this.getDailyContent(dayIndex);
      
      if (dailyContent && dailyContent[category]) {
        console.log(`✅ [getHistoricalInfo] ${category} trouvé:`, dailyContent[category].title);
        return dailyContent[category];
      }
      
      console.error(`❌ [getHistoricalInfo] ${category} non trouvé dans le contenu quotidien`);
      return this.getFallbackContent(category, dayIndex);
      
    } catch (error) {
      console.error(`❌ [getHistoricalInfo] Erreur pour ${category}:`, error);
      return this.getFallbackContent(category, dayIndex);
    }
  }

  async getDailyContent(dayIndex) {
    // Éviter les appels multiples avec un cache en mémoire
    if (this.dailyContentCache && this.dailyContentCache.dayIndex === dayIndex) {
      console.log(`🎯 [getDailyContent] Cache mémoire utilisé pour index ${dayIndex}`);
      return this.dailyContentCache.content;
    }

    console.log(`📡 [getDailyContent] Appel API pour index ${dayIndex}`);
    
    try {
      const response = await $fetch('/api/get-daily-content', {
        method: 'POST',
        body: { dayIndex }
      });

      if (response && response.content) {
        // Mettre en cache en mémoire
        this.dailyContentCache = {
          dayIndex,
          content: response.content
        };
        
        console.log(`💾 [getDailyContent] ${Object.keys(response.content).length} catégories chargées depuis ${response.source}`);
        return response.content;
      }
      
      throw new Error('Réponse invalide du serveur');
      
    } catch (error) {
      console.error(`❌ [getDailyContent] Erreur API:`, error);
      throw error;
    }
  }

  async getWorldHistoryByYear(year) {
    const prompt = `Donne-moi UN fait historique mondial important qui s'est passé en l'an ${year} ou autour de cette période. Si rien d'important ne s'est passé exactement cette année-là, trouve l'événement le plus proche chronologiquement. Réponds au format:
    
    Titre: [titre court]
    Date: [date précise si connue, sinon année]
    Description: [description courte de 2-3 phrases maximum]
    Importance: [pourquoi c'est important en 1 phrase]
    
    Évite les événements trop répétitifs ou similaires.`;

    return await this.queryAI(prompt, `world_history_${year}`);
  }

  async getFranceHistoryByYear(year) {
    const prompt = `Donne-moi UN fait historique français important qui s'est passé en l'an ${year} ou autour de cette période. Si rien d'important ne s'est passé exactement cette année-là, trouve l'événement français le plus proche chronologiquement. Réponds au format:
    
    Titre: [titre court]
    Date: [date précise si connue, sinon année]
    Description: [description courte de 2-3 phrases maximum]
    Importance: [pourquoi c'est important pour la France en 1 phrase]
    
    Concentre-toi sur l'histoire de France spécifiquement.`;

    return await this.queryAI(prompt, `france_history_${year}`);
  }

  async getEgyptHistoryByYear(year) {
    const prompt = `Donne-moi UN fait historique de l'Égypte antique ou moderne important qui s'est passé en l'an ${year} ou autour de cette période. Si rien d'important ne s'est passé exactement cette année-là, trouve l'événement égyptien le plus proche chronologiquement. Réponds au format:
    
    Titre: [titre court]
    Date: [date précise si connue, sinon année]
    Description: [description courte de 2-3 phrases maximum]
    Importance: [pourquoi c'est important pour l'Égypte en 1 phrase]
    
    Inclus à la fois l'Égypte antique et moderne.`;

    return await this.queryAI(prompt, `egypt_history_${year}`);
  }

  async getRomeHistoryByYear(year) {
    const prompt = `Donne-moi UN fait historique de Rome antique important qui s'est passé en l'an ${year} ou autour de cette période. Si rien d'important ne s'est passé exactement cette année-là, trouve l'événement romain le plus proche chronologiquement. Réponds au format:
    
    Titre: [titre court]
    Date: [date précise si connue, sinon année]
    Description: [description courte de 2-3 phrases maximum]
    Importance: [pourquoi c'est important pour Rome en 1 phrase]
    
    Concentre-toi sur l'Empire et la République romaine.`;

    return await this.queryAI(prompt, `rome_history_${year}`);
  }

  async getRandomCountryCapital(dayIndex) {
    try {
      // Utilise un seed basé sur dayIndex pour avoir toujours le même pays pour le même jour
      const countries = await this.getAllCountries();
      const countryIndex = dayIndex % countries.length;
      const country = countries[countryIndex];
      
      return {
        title: `Pays: ${country.name.common}`,
        content: `Capitale: ${country.capital?.[0] || 'Non disponible'}`,
        description: `${country.name.common} se trouve en ${country.region}, sous-région ${country.subregion || 'non spécifiée'}.`,
        importance: `Important à connaître pour la géographie mondiale.`,
        question: `Quelle est la capitale de ${country.name.common} ?`,
        answer: country.capital?.[0] || 'Non disponible'
      };
    } catch (error) {
      return this.getFallbackContent('countries_capitals', dayIndex);
    }
  }

  async getCinemaFact(dayIndex) {
    const topics = [
      'premiers films de l\'histoire du cinéma',
      'invention du cinéma par les frères Lumière', 
      'naissance d\'Hollywood',
      'premiers Oscars',
      'films muets emblématiques',
      'transition vers le cinéma parlant',
      'naissance du cinéma en couleur',
      'grands réalisateurs pionniers',
      'histoire des effets spéciaux',
      'évolution des salles de cinéma'
    ];

    const topic = topics[dayIndex % topics.length];
    const prompt = `Donne-moi UN fait intéressant sur ${topic}. Réponds au format:
    
    Titre: [titre court]
    Date: [date ou période]
    Description: [description courte de 2-3 phrases maximum]
    Importance: [pourquoi c'est important pour l'histoire du cinéma]`;

    return await this.queryAI(prompt, `cinema_${dayIndex}`);
  }

  async getLiteratureFact(dayIndex) {
    const topics = [
      'écrivains Prix Nobel de littérature',
      'chefs-d\'œuvre de la littérature française',
      'naissance de grands mouvements littéraires',
      'premières publications d\'œuvres majeures',
      'vies des grands écrivains classiques',
      'histoire de l\'imprimerie et du livre',
      'salons littéraires historiques',
      'censure et liberté d\'expression littéraire',
      'traductions qui ont marqué l\'histoire',
      'bibliothèques historiques importantes'
    ];

    const topic = topics[dayIndex % topics.length];
    const prompt = `Donne-moi UN fait intéressant sur ${topic}. Réponds au format:
    
    Titre: [titre court]
    Date: [date ou période]
    Description: [description courte de 2-3 phrases maximum]
    Importance: [pourquoi c'est important pour la littérature]`;

    return await this.queryAI(prompt, `literature_${dayIndex}`);
  }

  async getNobelPrizeFact(dayIndex) {
    const categories = ['physique', 'chimie', 'médecine', 'mathématiques (médaille Fields)'];
    const category = categories[dayIndex % categories.length];
    
    const prompt = `Donne-moi UN fait intéressant sur un Prix Nobel de ${category} ou une découverte majeure dans ce domaine. Réponds au format:
    
    Titre: [titre court]
    Date: [date ou année]
    Description: [description courte de 2-3 phrases maximum]
    Importance: [pourquoi c'est important pour la science]`;

    return await this.queryAI(prompt, `nobel_${category}_${dayIndex}`);
  }

  async queryAI(prompt, uniqueKey) {
    if (this.usedContent.has(uniqueKey)) {
      prompt += `\n\nIMPORTANT: Donne-moi un fait DIFFÉRENT de celui potentiellement donné précédemment pour cette même requête.`;
    }

    console.log('🔍 [ContentFetcher] Début queryAI pour:', uniqueKey);

    try {
      console.log('📡 [ContentFetcher] Appel Claude API...');
      const response = await this.callClaudeAPI(prompt, uniqueKey);
      console.log('✅ [ContentFetcher] Réponse Claude reçue:', response);
      
      this.usedContent.add(uniqueKey);
      
      const result = {
        ...response,
        question: this.generateQuestion(response),
        answer: response.description || response.title,
        source: response.source || 'Claude',
        uniqueKey
      };
      
      console.log('🎯 [ContentFetcher] Résultat final queryAI:', result);
      return result;
      
    } catch (error) {
      console.error('❌ [ContentFetcher] Erreur API Claude:', error);
      console.error('❌ [ContentFetcher] Détails de l\'erreur:', error);
      
      // TEMPORAIRE : on force l'erreur pour voir les vraies données Claude
      throw new Error('Force API Claude - pas de fallback simulation');
    }
  }

  async callClaudeAPI(prompt, uniqueKey) {
    try {
      console.log('📞 [callClaudeAPI] Début appel pour:', uniqueKey);
      console.log('📞 [callClaudeAPI] Prompt:', prompt.substring(0, 100) + '...');
      
      console.log('🔗 [callClaudeAPI] Appel $fetch...');
      const response = await $fetch('/api/generate-content', {
        method: 'POST',
        body: {
          prompt: prompt,
          uniqueKey: uniqueKey
        }
      });

      console.log('📨 [callClaudeAPI] Réponse brute reçue:', JSON.stringify(response, null, 2));
      console.log('📊 [callClaudeAPI] Type de réponse:', typeof response);
      console.log('📊 [callClaudeAPI] Titre:', response?.title);
      
      if (!response || !response.title) {
        console.error('❌ [callClaudeAPI] Réponse invalide ou manquante. Réponse complète:', response);
        throw new Error(`Réponse API invalide: ${JSON.stringify(response)}`);
      }
      
      console.log('✅ [callClaudeAPI] Réponse valide, titre:', response.title);
      return response;
      
    } catch (error) {
      console.error('❌ [callClaudeAPI] Erreur $fetch:', error.message);
      console.error('❌ [callClaudeAPI] Type erreur:', error.constructor.name);
      console.error('❌ [callClaudeAPI] Code erreur:', error.statusCode);
      console.error('❌ [callClaudeAPI] Data erreur:', error.data);
      console.error('❌ [callClaudeAPI] Stack:', error.stack);
      throw error;
    }
  }

  parseAIResponse(content, uniqueKey) {
    // Parser le format : Titre: ... Date: ... Description: ... Importance: ...
    const lines = content.split('\n').filter(line => line.trim());
    const result = {
      title: 'Information historique',
      date: 'Date inconnue', 
      description: 'Information générée',
      importance: 'Important pour la culture générale'
    };

    lines.forEach(line => {
      if (line.startsWith('Titre:')) {
        result.title = line.replace('Titre:', '').trim();
      } else if (line.startsWith('Date:')) {
        result.date = line.replace('Date:', '').trim();
      } else if (line.startsWith('Description:')) {
        result.description = line.replace('Description:', '').trim();
      } else if (line.startsWith('Importance:')) {
        result.importance = line.replace('Importance:', '').trim();
      }
    });

    return result;
  }

  generateQuestion(content) {
    // Génère une question basée sur le contenu
    if (!content || !content.title) {
      return "Question sur cet événement historique ?";
    }
    return `En quelle année ${content.title.toLowerCase()} ?`;
  }

  async getAllCountries() {
    try {
      const response = await axios.get(this.apiEndpoints.restCountries);
      return response.data;
    } catch (error) {
      // Fallback avec quelques pays
      return [
        { name: { common: 'France' }, capital: ['Paris'], region: 'Europe', subregion: 'Western Europe' },
        { name: { common: 'Allemagne' }, capital: ['Berlin'], region: 'Europe', subregion: 'Western Europe' },
        { name: { common: 'Italie' }, capital: ['Rome'], region: 'Europe', subregion: 'Southern Europe' }
      ];
    }
  }

  getFallbackContent(category, dayIndex) {
    const fallbacks = {
      world_history: {
        title: "Événement historique mondial",
        description: "Un événement important s'est déroulé dans l'histoire mondiale.",
        importance: "Important pour comprendre l'évolution de l'humanité."
      },
      france_history: {
        title: "Événement historique français", 
        description: "Un événement important s'est déroulé dans l'histoire de France.",
        importance: "Important pour comprendre l'histoire française."
      }
      // Ajoute d'autres fallbacks...
    };

    return {
      ...fallbacks[category] || fallbacks.world_history,
      date: "Date inconnue",
      question: "Question sur cet événement historique ?",
      answer: "Réponse basée sur le contenu ci-dessus.",
      source: 'fallback',
      uniqueKey: `${category}_fallback_${dayIndex}`
    };
  }
}