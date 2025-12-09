import fs from 'fs';
import path from 'path';

const CACHE_FILE_PATH = path.join(process.cwd(), 'server/data/content-cache.json');

export default defineEventHandler(async (event) => {
  try {
    const { currentIndex, reviewIndexes } = await readBody(event);

    if (typeof currentIndex !== 'number' || !Array.isArray(reviewIndexes)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'currentIndex (number) et reviewIndexes (array) requis'
      });
    }

    console.log(`📚 [get-review-content] Chargement des révisions pour index ${currentIndex}, révisions: ${reviewIndexes.join(', ')}`);

    const cache = loadCache();
    const reviewQuestions = [];

    reviewIndexes.forEach(reviewIndex => {
      const dayContent = cache[reviewIndex];

      if (dayContent && typeof dayContent === 'object') {
        const daysDiff = currentIndex - reviewIndex;
        let reviewType = 'daily_review';

        if (daysDiff >= 365) reviewType = 'yearly_review';
        else if (daysDiff >= 180) reviewType = 'halfyearly_review';
        else if (daysDiff >= 30) reviewType = 'monthly_review';
        else if (daysDiff >= 7) reviewType = 'weekly_review';

        // Parcourir chaque thème du jour
        Object.entries(dayContent).forEach(([category, item]) => {
          if (item && item.question && item.answer) {
            reviewQuestions.push({
              question: item.question,
              answer: item.answer,
              category: category,
              original_index: reviewIndex,
              review_index: currentIndex,
              type: reviewType,
              days_since_learned: daysDiff
            });
          }
        });
      }
    });

    console.log(`✅ [get-review-content] ${reviewQuestions.length} questions de révision trouvées`);

    return {
      success: true,
      questions: reviewQuestions,
      count: reviewQuestions.length
    };

  } catch (error) {
    console.error('❌ [get-review-content] Erreur:', error);
    return {
      success: false,
      questions: [],
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
