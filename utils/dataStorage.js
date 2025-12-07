// Gestion des fichiers côté client avec localStorage comme fallback
const isServer = process.server;

export class DataStorage {
  constructor() {
    this.dataDir = path.join(process.cwd(), 'data');
    this.learningDataFile = path.join(this.dataDir, 'learning_data.json');
    this.quizDataFile = path.join(this.dataDir, 'quiz_data.json');
    this.progressFile = path.join(this.dataDir, 'progress.json');
    
    this.ensureDataDirectory();
    this.initializeFiles();
  }

  ensureDataDirectory() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  initializeFiles() {
    const files = [
      { file: this.learningDataFile, defaultData: { daily_content: {} } },
      { file: this.quizDataFile, defaultData: { questions: [] } },
      { file: this.progressFile, defaultData: { last_access: null, streak: 0 } }
    ];

    files.forEach(({ file, defaultData }) => {
      if (!fs.existsSync(file)) {
        this.writeJSON(file, defaultData);
      }
    });
  }

  readJSON(filePath) {
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error(`Erreur lecture ${filePath}:`, error);
      return {};
    }
  }

  writeJSON(filePath, data) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      return true;
    } catch (error) {
      console.error(`Erreur écriture ${filePath}:`, error);
      return false;
    }
  }

  saveDailyContent(date, content) {
    const data = this.readJSON(this.learningDataFile);
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

    return this.writeJSON(this.learningDataFile, data);
  }

  getDailyContent(date) {
    const data = this.readJSON(this.learningDataFile);
    const dateKey = this.formatDateKey(date);
    return data.daily_content?.[dateKey] || null;
  }

  getAllDailyContent() {
    const data = this.readJSON(this.learningDataFile);
    return data.daily_content || {};
  }

  saveQuizQuestion(question) {
    const quizData = this.readJSON(this.quizDataFile);
    
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
      ebbinghaus_level: 1
    };

    quizData.questions.push(questionWithId);
    return this.writeJSON(this.quizDataFile, questionWithId);
  }

  getQuizQuestions(filters = {}) {
    const quizData = this.readJSON(this.quizDataFile);
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
    const quizData = this.readJSON(this.quizDataFile);
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

    // Calculer la prochaine date de révision selon Ebbinghaus
    question.next_review_date = this.calculateNextReviewDate(question.ebbinghaus_level);

    return this.writeJSON(this.quizDataFile, quizData);
  }

  calculateNextReviewDate(level) {
    const intervals = [1, 3, 7, 15, 30, 90]; // jours
    const interval = intervals[Math.min(level - 1, intervals.length - 1)];
    
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + interval);
    return nextDate.toISOString();
  }

  getWeeklyQuizData(date) {
    const weekDates = this.getWeekDates(date);
    const dailyContent = this.getAllDailyContent();
    
    const weeklyQuestions = [];
    weekDates.forEach(weekDate => {
      const dateKey = this.formatDateKey(weekDate);
      const content = dailyContent[dateKey];
      
      if (content) {
        content.content.forEach(item => {
          weeklyQuestions.push({
            question: item.question,
            answer: item.answer,
            category: item.category,
            original_date: dateKey,
            type: 'weekly_review'
          });
        });
      }
    });

    return weeklyQuestions;
  }

  getMonthlyQuizData(date) {
    const monthDates = this.getMonthDates(date);
    const dailyContent = this.getAllDailyContent();
    
    const monthlyQuestions = [];
    monthDates.forEach(monthDate => {
      const dateKey = this.formatDateKey(monthDate);
      const content = dailyContent[dateKey];
      
      if (content) {
        content.content.forEach(item => {
          monthlyQuestions.push({
            question: item.question,
            answer: item.answer,
            category: item.category,
            original_date: dateKey,
            type: 'monthly_review'
          });
        });
      }
    });

    return monthlyQuestions;
  }

  getHalfYearlyQuizData(date) {
    const halfYearDates = this.getHalfYearDates(date);
    const dailyContent = this.getAllDailyContent();
    
    const halfYearlyQuestions = [];
    halfYearDates.forEach(halfYearDate => {
      const dateKey = this.formatDateKey(halfYearDate);
      const content = dailyContent[dateKey];
      
      if (content) {
        content.content.forEach(item => {
          halfYearlyQuestions.push({
            question: item.question,
            answer: item.answer,
            category: item.category,
            original_date: dateKey,
            type: 'halfyearly_review'
          });
        });
      }
    });

    return halfYearlyQuestions;
  }

  getYearlyQuizData(date) {
    const yearDates = this.getYearDates(date);
    const dailyContent = this.getAllDailyContent();
    
    const yearlyQuestions = [];
    yearDates.forEach(yearDate => {
      const dateKey = this.formatDateKey(yearDate);
      const content = dailyContent[dateKey];
      
      if (content) {
        content.content.forEach(item => {
          yearlyQuestions.push({
            question: item.question,
            answer: item.answer,
            category: item.category,
            original_date: dateKey,
            type: 'yearly_review'
          });
        });
      }
    });

    return yearlyQuestions;
  }

  updateProgress(data) {
    const progress = this.readJSON(this.progressFile);
    Object.assign(progress, data);
    return this.writeJSON(this.progressFile, progress);
  }

  getProgress() {
    return this.readJSON(this.progressFile);
  }

  formatDateKey(date) {
    return date.toISOString().split('T')[0];
  }

  generateId() {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }

  getWeekDates(date) {
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay() + 1);
    
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

  // Méthodes utilitaires pour le nettoyage et la maintenance
  cleanupOldData(daysToKeep = 400) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const learningData = this.readJSON(this.learningDataFile);
    const quizData = this.readJSON(this.quizDataFile);
    
    // Nettoyer les données d'apprentissage anciennes
    if (learningData.daily_content) {
      Object.keys(learningData.daily_content).forEach(dateKey => {
        const itemDate = new Date(dateKey);
        if (itemDate < cutoffDate) {
          delete learningData.daily_content[dateKey];
        }
      });
    }

    // Nettoyer les questions de quiz très anciennes (mais garder celles encore en révision)
    if (quizData.questions) {
      quizData.questions = quizData.questions.filter(question => {
        const questionDate = new Date(question.created_at);
        const nextReview = new Date(question.next_review_date);
        return questionDate >= cutoffDate || nextReview >= new Date();
      });
    }

    this.writeJSON(this.learningDataFile, learningData);
    this.writeJSON(this.quizDataFile, quizData);
  }
}