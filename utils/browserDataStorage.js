export class BrowserDataStorage {
  constructor() {
    this.learningDataKey = 'ebbinghaus_learning_data';
    this.quizDataKey = 'ebbinghaus_quiz_data';
    this.progressKey = 'ebbinghaus_progress';
    
    this.initializeStorage();
  }

  initializeStorage() {
    if (typeof window !== 'undefined') {
      const keys = [this.learningDataKey, this.quizDataKey, this.progressKey];
      const defaults = [
        { daily_content: {} },
        { questions: [] },
        { last_access: null, streak: 0 }
      ];

      keys.forEach((key, index) => {
        if (!localStorage.getItem(key)) {
          localStorage.setItem(key, JSON.stringify(defaults[index]));
        }
      });
    }
  }

  readData(key) {
    if (typeof window === 'undefined') return {};
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error(`Erreur lecture ${key}:`, error);
      return {};
    }
  }

  writeData(key, data) {
    if (typeof window === 'undefined') return false;
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error(`Erreur écriture ${key}:`, error);
      return false;
    }
  }

  saveDailyContent(date, content) {
    const data = this.readData(this.learningDataKey);
    const dateKey = this.formatDateKey(date);

    if (!data.daily_content) {
      data.daily_content = {};
    }

    data.daily_content[dateKey] = {
      date: dateKey,
      content,
      created_at: new Date().toISOString(),
      reviewed: false
    };

    return this.writeData(this.learningDataKey, data);
  }

  // Nouvelle méthode pour sauvegarder par index
  saveDailyContentByIndex(index, content) {
    const data = this.readData(this.learningDataKey);

    if (!data.daily_content_by_index) {
      data.daily_content_by_index = {};
    }

    data.daily_content_by_index[index] = {
      index,
      content,
      created_at: new Date().toISOString(),
      reviewed: false
    };

    return this.writeData(this.learningDataKey, data);
  }

  // Récupère le contenu par index
  getDailyContentByIndex(index) {
    const data = this.readData(this.learningDataKey);
    return data.daily_content_by_index?.[index] || null;
  }

  getDailyContent(date) {
    const data = this.readData(this.learningDataKey);
    const dateKey = this.formatDateKey(date);
    return data.daily_content?.[dateKey] || null;
  }

  clearDailyContent(date) {
    const data = this.readData(this.learningDataKey);
    const dateKey = this.formatDateKey(date);
    
    if (data.daily_content && data.daily_content[dateKey]) {
      delete data.daily_content[dateKey];
      console.log('🗑️ [clearDailyContent] Contenu supprimé pour:', dateKey);
      return this.writeData(this.learningDataKey, data);
    }
    
    return true;
  }

  getAllDailyContent() {
    const data = this.readData(this.learningDataKey);
    return data.daily_content || {};
  }

  saveQuizQuestion(question) {
    const quizData = this.readData(this.quizDataKey);
    
    if (!quizData.questions) {
      quizData.questions = [];
    }

    const questionWithId = {
      id: this.generateId(),
      ...question,
      created_at: new Date().toISOString(),
      last_reviewed: null,
      review_count: 0,
      correct_count: 0,
      ebbinghaus_level: 1,
      next_review_date: this.calculateNextReviewDate(1)
    };

    quizData.questions.push(questionWithId);
    return this.writeData(this.quizDataKey, quizData);
  }

  getQuizQuestions(filters = {}) {
    const quizData = this.readData(this.quizDataKey);
    let questions = quizData.questions || [];

    if (filters.date_range) {
      const { start, end } = filters.date_range;
      questions = questions.filter(q => {
        const qDate = new Date(q.original_date);
        return qDate >= start && qDate <= end;
      });
    }

    if (filters.category) {
      questions = questions.filter(q => q.category === filters.category);
    }

    if (filters.ebbinghaus_due) {
      const today = new Date();
      questions = questions.filter(q => {
        const dueDate = new Date(q.next_review_date);
        return dueDate <= today;
      });
    }

    return questions;
  }

  updateQuestionReview(questionId, isCorrect) {
    const quizData = this.readData(this.quizDataKey);
    const questionIndex = quizData.questions.findIndex(q => q.id === questionId);
    
    if (questionIndex === -1) return false;

    const question = quizData.questions[questionIndex];
    question.last_reviewed = new Date().toISOString();
    question.review_count += 1;
    
    if (isCorrect) {
      question.correct_count += 1;
      question.ebbinghaus_level = Math.min(question.ebbinghaus_level + 1, 6);
    } else {
      question.ebbinghaus_level = Math.max(1, question.ebbinghaus_level - 1);
    }

    question.next_review_date = this.calculateNextReviewDate(question.ebbinghaus_level);

    return this.writeData(this.quizDataKey, quizData);
  }

  calculateNextReviewDate(level) {
    const intervals = [1, 3, 7, 15, 30, 90];
    const interval = intervals[Math.min(level - 1, intervals.length - 1)];
    
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + interval);
    return nextDate.toISOString();
  }

  getEbbinghausReviewData(currentDate, reviewDates) {
    const dailyContent = this.getAllDailyContent();
    const reviewQuestions = [];

    reviewDates.forEach(reviewDate => {
      const dateKey = this.formatDateKey(reviewDate);
      const content = dailyContent[dateKey];

      if (content && content.content) {
        const daysDiff = Math.floor((currentDate - reviewDate) / (1000 * 60 * 60 * 24));
        let reviewType = 'daily_review';

        if (daysDiff >= 365) reviewType = 'yearly_review';
        else if (daysDiff >= 180) reviewType = 'halfyearly_review';
        else if (daysDiff >= 30) reviewType = 'monthly_review';
        else if (daysDiff >= 7) reviewType = 'weekly_review';

        content.content.forEach(item => {
          reviewQuestions.push({
            question: item.question,
            answer: item.answer,
            category: item.category,
            original_date: dateKey,
            review_date: this.formatDateKey(currentDate),
            type: reviewType,
            days_since_learned: daysDiff
          });
        });
      }
    });

    return reviewQuestions;
  }

  // Nouvelle méthode pour les révisions basées sur index
  getEbbinghausReviewDataByIndex(currentIndex, reviewIndexes) {
    const data = this.readData(this.learningDataKey);
    const contentByIndex = data.daily_content_by_index || {};
    const reviewQuestions = [];

    reviewIndexes.forEach(reviewIndex => {
      const content = contentByIndex[reviewIndex];

      if (content && content.content) {
        const daysDiff = currentIndex - reviewIndex;
        let reviewType = 'daily_review';

        if (daysDiff >= 365) reviewType = 'yearly_review';
        else if (daysDiff >= 180) reviewType = 'halfyearly_review';
        else if (daysDiff >= 30) reviewType = 'monthly_review';
        else if (daysDiff >= 7) reviewType = 'weekly_review';

        content.content.forEach(item => {
          if (item.question && item.answer) {
            reviewQuestions.push({
              question: item.question,
              answer: item.answer,
              category: item.category,
              original_index: reviewIndex,
              review_index: currentIndex,
              type: reviewType,
              days_since_learned: daysDiff
            });
          }
        });
      }
    });

    return reviewQuestions;
  }

  updateProgress(data) {
    const progress = this.readData(this.progressKey);
    Object.assign(progress, data);
    return this.writeData(this.progressKey, progress);
  }

  getProgress() {
    return this.readData(this.progressKey);
  }

  formatDateKey(date) {
    return date.toISOString().split('T')[0];
  }

  generateId() {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }

  getWeekDates(date) {
    const startOfWeek = new Date(date);
    const dayOfWeek = startOfWeek.getDay();
    const monday = startOfWeek.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    startOfWeek.setDate(monday);
    
    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(startOfWeek);
      currentDate.setDate(startOfWeek.getDate() + i);
      if (currentDate < date) {
        weekDates.push(currentDate);
      }
    }
    return weekDates;
  }

  getMonthDates(date) {
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthDates = [];
    
    for (let d = new Date(startOfMonth); d < date; d.setDate(d.getDate() + 1)) {
      monthDates.push(new Date(d));
    }
    return monthDates;
  }

  getHalfYearDates(date) {
    const startMonth = date.getMonth() < 6 ? 0 : 6;
    const startDate = new Date(date.getFullYear(), startMonth, 1);
    const halfYearDates = [];
    
    for (let d = new Date(startDate); d < date; d.setDate(d.getDate() + 1)) {
      halfYearDates.push(new Date(d));
    }
    return halfYearDates;
  }

  getYearDates(date) {
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const yearDates = [];
    
    for (let d = new Date(startOfYear); d < date; d.setDate(d.getDate() + 1)) {
      yearDates.push(new Date(d));
    }
    return yearDates;
  }

  cleanupOldData(daysToKeep = 400) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const learningData = this.readData(this.learningDataKey);
    const quizData = this.readData(this.quizDataKey);
    
    if (learningData.daily_content) {
      Object.keys(learningData.daily_content).forEach(dateKey => {
        const itemDate = new Date(dateKey);
        if (itemDate < cutoffDate) {
          delete learningData.daily_content[dateKey];
        }
      });
    }

    if (quizData.questions) {
      quizData.questions = quizData.questions.filter(question => {
        const questionDate = new Date(question.created_at);
        const nextReview = new Date(question.next_review_date);
        return questionDate >= cutoffDate || nextReview >= new Date();
      });
    }

    this.writeData(this.learningDataKey, learningData);
    this.writeData(this.quizDataKey, quizData);
  }
}