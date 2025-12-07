<template>
  <div class="ebbinghaus-app">
    <header class="app-header">
      <h1>Apprentissage Ebbinghaus</h1>
      <div class="date-info">
        <p>Jour {{ currentDayIndex }} - {{ formatDate(currentDate) }}</p>
        <p class="day-type">{{ dayTypeLabel }}</p>
      </div>
    </header>

    <main class="main-content">
      <!-- Nouveau contenu du jour -->
      <div class="today-content">
        <h2>🎯 Nouveau contenu d'aujourd'hui</h2>
        <div v-if="loading" class="loading">Chargement du contenu...</div>
        <div v-else class="content-cards">
          <div v-for="(item, index) in todayContent" :key="index" class="content-card">
            <div class="card-header">
              <div class="category-badge">{{ getCategoryLabel(item.category) }}</div>
              <div v-if="item.source" class="source-badge">{{ getSourceLabel(item.source) }}</div>
            </div>
            <h4>{{ item.title }}</h4>
            <div class="content-date">{{ item.date }}</div>
            <div class="content-description">{{ item.description }}</div>
            <div class="content-importance">
              <strong>Importance:</strong> {{ item.importance }}
            </div>
          </div>
        </div>
      </div>

      <!-- Révisions Ebbinghaus -->
      <div v-if="reviewQuestions.length > 0" class="review-section">
        <h2>📚 Révisions Ebbinghaus</h2>
        <div class="review-info">
          <p>{{ reviewQuestions.length }} questions à réviser selon les intervalles Ebbinghaus</p>
        </div>
        
        <div class="quiz-stats">
          <span>Question {{ currentQuestionIndex + 1 }} / {{ reviewQuestions.length }}</span>
          <span>Score: {{ score }}/{{ answeredQuestions }}</span>
        </div>
        
        <div v-if="currentReviewQuestion" class="quiz-question">
          <div class="question-card">
            <div class="question-meta">
              <span class="review-badge">{{ getReviewTypeLabel(currentReviewQuestion.type) }}</span>
              <span class="original-date">Appris au Jour {{ currentReviewQuestion.original_index || currentReviewQuestion.original_date }}</span>
              <span class="days-ago">Il y a {{ currentReviewQuestion.days_since_learned }} jours</span>
            </div>
            <div class="question">{{ currentReviewQuestion.question }}</div>
            <button @click="revealQuizAnswer" class="reveal-btn">
              {{ showQuizAnswer ? 'Question suivante' : 'Révéler la réponse' }}
            </button>
            <div v-if="showQuizAnswer" class="answer-section">
              <div class="answer">{{ currentReviewQuestion.answer }}</div>
              <div class="answer-buttons">
                <button @click="markAnswer(true)" class="correct-btn">✓ Correct</button>
                <button @click="markAnswer(false)" class="incorrect-btn">✗ Incorrect</button>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="quiz-completed">
          <h3>🎉 Révisions terminées !</h3>
          <p>Score final: {{ score }}/{{ answeredQuestions }}</p>
          <p>Excellent travail ! Revenez demain pour de nouvelles révisions.</p>
        </div>
      </div>

      <div v-else class="no-reviews">
        <h3>🎉 Aucune révision aujourd'hui</h3>
        <p>Vous n'avez pas encore de contenu à réviser selon les intervalles Ebbinghaus.</p>
        <p>Revenez dans quelques jours !</p>
      </div>
    </main>

    <!-- Navigation -->
    <nav class="bottom-nav">
      <button @click="loadPreviousDay" :disabled="!canGoPrevious">← Jour précédent</button>
      <button @click="loadToday">Aujourd'hui</button>
      <button @click="loadNextDay" :disabled="!canGoNext">Jour suivant →</button>
      <button @click="forceReloadToday" class="reload-btn" :disabled="loading">🔄 Forcer rechargement</button>
      <button @click="$router.push('/themes')" class="themes-btn">🎨 Gérer les thèmes</button>
    </nav>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { DateManager } from '~/utils/dateManager.js';
import { ContentFetcher } from '~/utils/contentFetcher.js';
import { BrowserDataStorage } from '~/utils/browserDataStorage.js';

const dateManager = new DateManager();
const contentFetcher = new ContentFetcher();
const dataStorage = new BrowserDataStorage();

// État réactif
const currentDate = ref(new Date());
const currentDayIndex = ref(1);  // Index séquentiel simple
const todayContent = ref([]);
const reviewQuestions = ref([]);
const currentQuestionIndex = ref(0);
const showQuizAnswer = ref(false);
const loading = ref(false);
const score = ref(0);
const answeredQuestions = ref(0);

// Calculé
const dayType = computed(() => dateManager.getDayType(currentDate.value));
const dayTypeLabel = computed(() => {
  return 'Apprentissage avec révisions Ebbinghaus';
});

const reviewDates = computed(() => {
  return dateManager.getEbbinghausReviewDates(currentDate.value);
});

const currentReviewQuestion = computed(() => {
  return reviewQuestions.value[currentQuestionIndex.value] || null;
});

const canGoPrevious = computed(() => {
  return currentDayIndex.value > 1;
});

const canGoNext = computed(() => {
  // On peut toujours avancer (le système va générer du nouveau contenu)
  return true;
});

// Méthodes
const loadDayContent = async () => {
  loading.value = true;
  
  try {
    await loadTodayContent();
    await loadReviewQuestions();
  } catch (error) {
    console.error('Erreur lors du chargement:', error);
  } finally {
    loading.value = false;
  }
};

const loadTodayContent = async () => {
  console.log('🚀 [loadTodayContent] Début du chargement...');
  console.log('🚀 [loadTodayContent] Index du jour:', currentDayIndex.value);

  // Vider seulement le cache mémoire (pas le serveur)
  contentFetcher.dailyContentCache = null;
  console.log('🗑️ [loadTodayContent] Cache mémoire vidé');

  const dayIndex = currentDayIndex.value;
  console.log('📅 [loadTodayContent] Chargement pour index:', dayIndex);

  const newContent = [];

  // Obtenir les catégories actives dynamiquement
  const activeCategories = await dateManager.getActiveCategories();
  console.log(`🎨 [loadTodayContent] ${activeCategories.length} catégories actives`);

  for (const category of activeCategories) {
    console.log(`📦 [loadTodayContent] Chargement ${category}...`);
    try {
      const content = await contentFetcher.getHistoricalInfo(category, dayIndex);
      console.log(`✅ [loadTodayContent] ${category} chargé:`, content.title);
      newContent.push({ ...content, category });
    } catch (error) {
      console.error(`❌ [loadTodayContent] Erreur pour ${category}:`, error.message);
      console.error(`❌ [loadTodayContent] Stack pour ${category}:`, error.stack);

      // Ajouter un contenu d'erreur visible
      newContent.push({
        title: `ERREUR: ${category}`,
        date: new Date().toLocaleDateString(),
        description: `Erreur lors du chargement: ${error.message}`,
        importance: 'Erreur technique',
        category: category,
        source: 'erreur'
      });
    }
  }

  console.log('📋 [loadTodayContent] Contenu final:', newContent);

  // Sauvegarder le nouveau contenu dans localStorage avec l'index
  dataStorage.saveDailyContentByIndex(dayIndex, newContent);

  todayContent.value = newContent;
};

const loadReviewQuestions = async () => {
  // Obtenir les index de révision selon Ebbinghaus (1, 7, 30, 180, 365 jours avant)
  const reviewIndexes = dateManager.getEbbinghausReviewIndexes(currentDayIndex.value);

  // Charger les questions de révision basées sur les index
  const questions = dataStorage.getEbbinghausReviewDataByIndex(currentDayIndex.value, reviewIndexes);

  // Mélanger les questions
  reviewQuestions.value = shuffleArray([...questions]);
  currentQuestionIndex.value = 0;
  showQuizAnswer.value = false;
  score.value = 0;
  answeredQuestions.value = 0;
};

const revealQuizAnswer = () => {
  if (!showQuizAnswer.value) {
    showQuizAnswer.value = true;
  } else {
    // Passer à la question suivante
    nextQuestion();
  }
};

const markAnswer = (isCorrect) => {
  if (isCorrect) {
    score.value++;
  }
  answeredQuestions.value++;
  
  nextQuestion();
};

const nextQuestion = () => {
  if (currentQuestionIndex.value < reviewQuestions.value.length - 1) {
    currentQuestionIndex.value++;
    showQuizAnswer.value = false;
  }
  // Sinon on reste sur la dernière question et on affiche "Quiz terminé"
};

const getCategoryLabel = (category) => {
  const labels = {
    'world_history': '🌍 Histoire Mondiale',
    'france_history': '🇫🇷 Histoire de France', 
    'egypt_history': '🏺 Histoire d\'Égypte',
    'rome_history': '🏛️ Histoire de Rome',
    'countries_capitals': '🗺️ Pays & Capitales',
    'cinema': '🎬 Cinéma',
    'literature': '📚 Littérature',
    'nobel_prizes': '🏆 Prix Nobel'
  };
  return labels[category] || category;
};

const formatDate = (date) => {
  return new Intl.DateTimeFormat('fr-FR', { 
    weekday: 'long',
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  }).format(date);
};

const formatReviewDate = (dateString) => {
  return new Intl.DateTimeFormat('fr-FR', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  }).format(new Date(dateString));
};

const getReviewTypeLabel = (type) => {
  const labels = {
    'daily_review': '📅 Révision quotidienne',
    'weekly_review': '📅 Révision hebdomadaire', 
    'monthly_review': '📅 Révision mensuelle',
    'halfyearly_review': '📅 Révision semestrielle',
    'yearly_review': '📅 Révision annuelle'
  };
  return labels[type] || type;
};

const getSourceLabel = (source) => {
  const labels = {
    'Claude': '🤖 IA Claude',
    'simulation_enrichie': '📚 Base historique',
    'simulation_dynamique': '🎲 Contenu généré',
    'fallback': '⚠️ Mode dégradé'
  };
  return labels[source] || source;
};

const loadToday = async () => {
  // Charger l'index courant depuis le serveur
  try {
    const response = await $fetch('/api/get-current-index');
    currentDayIndex.value = response.currentIndex || 1;
    console.log('📅 [loadToday] Index chargé:', currentDayIndex.value);
  } catch (error) {
    console.error('❌ [loadToday] Erreur:', error);
    currentDayIndex.value = 1;
  }
};

const forceReloadToday = async () => {
  loading.value = true;

  try {
    // Vider complètement les caches
    contentFetcher.dailyContentCache = null;

    // Vider aussi le cache serveur pour cet index
    await $fetch('/api/clear-theme', {
      method: 'POST',
      body: { dayIndex: currentDayIndex.value, themeId: 'all' }
    });

    console.log('🗑️ [forceReloadToday] Caches vidés, rechargement...');

    // Recharger complètement
    await loadTodayContent();
    await loadReviewQuestions();

  } catch (error) {
    console.error('❌ [forceReloadToday] Erreur:', error);
  } finally {
    loading.value = false;
  }
};

const loadPreviousDay = () => {
  if (currentDayIndex.value > 1) {
    currentDayIndex.value--;
  }
};

const loadNextDay = () => {
  currentDayIndex.value++;
};

const shuffleArray = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

// Watchers
watch(currentDayIndex, () => {
  loadDayContent();
});

// Lifecycle
onMounted(async () => {
  // Charger l'index courant depuis le serveur
  await loadToday();

  // Charger le contenu immédiatement après avoir récupéré l'index
  await loadDayContent();

  // Mettre à jour les statistiques de progression
  dataStorage.updateProgress({
    last_access: new Date().toISOString(),
    current_index: currentDayIndex.value
  });
});
</script>

<style scoped>
.ebbinghaus-app {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.app-header {
  text-align: center;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 2px solid #e0e0e0;
}

.app-header h1 {
  color: #2c3e50;
  margin-bottom: 10px;
}

.date-info {
  color: #7f8c8d;
}

.day-type {
  font-weight: bold;
  color: #3498db;
}

.main-content {
  margin-bottom: 30px;
}

.review-section {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  margin-top: 30px;
  border-left: 4px solid #ffc107;
}

.review-info {
  text-align: center;
  margin-bottom: 20px;
  color: #6c757d;
}

.today-content {
  background: #ffffff;
  padding: 20px;
  border-radius: 8px;
  border-left: 4px solid #28a745;
}

.content-cards, .review-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  margin-top: 15px;
}

.content-card, .review-card {
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 15px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  flex-wrap: wrap;
  gap: 5px;
}

.category-badge {
  background: #007bff;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  display: inline-block;
}

.source-badge {
  background: #6c757d;
  color: white;
  padding: 3px 6px;
  border-radius: 3px;
  font-size: 10px;
  display: inline-block;
}

.content-date {
  color: #6c757d;
  font-size: 14px;
  margin: 8px 0;
}

.content-description {
  margin: 10px 0;
  line-height: 1.5;
}

.content-importance {
  color: #495057;
  font-size: 14px;
  margin-top: 10px;
  padding: 8px;
  background: #f8f9fa;
  border-radius: 4px;
}

.quiz-mode {
  text-align: center;
}

.question-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 15px;
  justify-content: center;
}

.review-badge {
  background: #17a2b8;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.original-date {
  background: #6c757d;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.days-ago {
  background: #28a745;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.quiz-completed {
  text-align: center;
  padding: 40px;
  background: #d4edda;
  border-radius: 8px;
  border: 1px solid #c3e6cb;
}

.no-reviews {
  text-align: center;
  padding: 40px;
  background: #e2e3e5;
  border-radius: 8px;
  color: #6c757d;
}

.api-status {
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 6px;
  padding: 10px;
  margin-bottom: 20px;
  text-align: center;
  color: #856404;
}

.quiz-stats {
  display: flex;
  justify-content: space-between;
  margin: 20px 0;
  padding: 10px 20px;
  background: #e9ecef;
  border-radius: 4px;
}

.question-card {
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 30px;
  margin: 20px auto;
  max-width: 600px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}

.question {
  font-size: 18px;
  margin-bottom: 20px;
  font-weight: 500;
}

.reveal-btn {
  background: #007bff;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s;
}

.reveal-btn:hover {
  background: #0056b3;
}

.answer-section {
  margin-top: 20px;
}

.answer {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 6px;
  margin-bottom: 15px;
  line-height: 1.5;
}

.answer-buttons {
  display: flex;
  gap: 10px;
  justify-content: center;
}

.correct-btn {
  background: #28a745;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
}

.incorrect-btn {
  background: #dc3545;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
}

.bottom-nav {
  display: flex;
  justify-content: center;
  gap: 15px;
  margin-top: 30px;
  padding: 20px 0;
  border-top: 1px solid #e0e0e0;
}

.bottom-nav button {
  padding: 10px 20px;
  border: 1px solid #007bff;
  background: white;
  color: #007bff;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s;
}

.bottom-nav button:hover:not(:disabled) {
  background: #007bff;
  color: white;
}

.bottom-nav button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  border-color: #6c757d;
  color: #6c757d;
}

.themes-btn {
  background: linear-gradient(45deg, #ff6b6b, #4ecdc4) !important;
  color: white !important;
  border: none !important;
  font-weight: bold;
}

.themes-btn:hover {
  background: linear-gradient(45deg, #ee5a52, #45b7b8) !important;
  transform: translateY(-2px);
}

.reload-btn {
  background: #ffc107 !important;
  color: #212529 !important;
  border: 2px solid #ffc107 !important;
  font-weight: bold;
}

.reload-btn:hover:not(:disabled) {
  background: #e0a800 !important;
  transform: translateY(-2px);
}

.reload-btn:disabled {
  background: #6c757d !important;
  border-color: #6c757d !important;
  color: white !important;
}

.loading {
  text-align: center;
  padding: 40px;
  color: #6c757d;
}

.no-quiz {
  text-align: center;
  padding: 40px;
  color: #6c757d;
}

@media (max-width: 768px) {
  .content-cards, .review-cards {
    grid-template-columns: 1fr;
  }
  
  .bottom-nav {
    flex-direction: column;
    align-items: center;
  }
  
  .quiz-stats {
    flex-direction: column;
    gap: 5px;
    text-align: center;
  }
}
</style>
