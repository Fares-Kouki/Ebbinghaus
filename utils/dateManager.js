export class DateManager {
  constructor() {
    this.categories = [];
    this.loadCategories();
  }

  async loadCategories() {
    try {
      const response = await $fetch('/api/themes');
      if (response.success && response.activeThemes) {
        this.categories = response.activeThemes.map(theme => theme.id);
        console.log(`🎨 [DateManager] ${this.categories.length} catégories chargées: ${this.categories.join(', ')}`);
      }
    } catch (error) {
      console.error('❌ [DateManager] Erreur chargement thèmes:', error);
      this.categories = [
        'world_history',
        'france_history',
        'egypt_history',
        'rome_history',
        'countries_capitals',
        'cinema',
        'literature',
        'nobel_prizes'
      ];
    }
  }

  async getActiveCategories() {
    if (this.categories.length === 0) {
      await this.loadCategories();
    }
    return this.categories;
  }

  // Récupère l'index courant depuis le cache serveur
  async getCurrentDayIndex() {
    try {
      const response = await $fetch('/api/get-current-index');
      return response.currentIndex || 1;
    } catch (error) {
      console.error('❌ [DateManager] Erreur récupération index:', error);
      return 1;
    }
  }

  // Pour la compatibilité - retourne l'index courant
  getDayIndexFromDate(date) {
    // Cette méthode n'est plus utilisée pour calculer l'index
    // Elle est gardée pour la compatibilité mais retourne toujours l'index courant via l'API
    console.warn('⚠️ [DateManager] getDayIndexFromDate est obsolète, utilisez getCurrentDayIndex()');
    return 1; // Valeur par défaut, sera remplacée par l'appel API
  }

  getCurrentDate() {
    return new Date();
  }

  isToday(date) {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }

  isSunday(date = new Date()) {
    return date.getDay() === 0;
  }

  isEndOfMonth(date = new Date()) {
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return date.getDate() === lastDay.getDate();
  }

  isHalfYear(date = new Date()) {
    return (date.getMonth() === 5 && this.isEndOfMonth(date)) ||
           (date.getMonth() === 11 && this.isEndOfMonth(date));
  }

  isEndOfYear(date = new Date()) {
    return date.getMonth() === 11 && this.isEndOfMonth(date);
  }

  getDayType(date = new Date()) {
    return 'daily_learning_with_review';
  }

  // Les index de révision Ebbinghaus : on révise le contenu des index passés
  getEbbinghausReviewIndexes(currentIndex) {
    const reviews = [];
    // Intervalles Ebbinghaus : 1 jour, 7 jours, 30 jours, 180 jours, 365 jours
    const intervals = [1, 7, 30, 180, 365];

    intervals.forEach(interval => {
      const reviewIndex = currentIndex - interval;
      if (reviewIndex >= 1) {
        reviews.push(reviewIndex);
      }
    });

    return reviews;
  }

  // Ancienne méthode gardée pour compatibilité avec le système de dates
  getEbbinghausReviewDates(currentDate) {
    const reviews = [];
    const today = new Date(currentDate);
    const intervals = [1, 7, 30, 180, 365];

    intervals.forEach(interval => {
      const reviewDate = new Date(today);
      reviewDate.setDate(today.getDate() - interval);
      reviews.push(reviewDate);
    });

    return reviews;
  }

  getWeekDates(date = new Date()) {
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay() + 1);

    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(startOfWeek);
      currentDate.setDate(startOfWeek.getDate() + i);
      weekDates.push(currentDate);
    }
    return weekDates;
  }

  getMonthDates(date = new Date()) {
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    const monthDates = [];
    for (let d = new Date(startOfMonth); d <= endOfMonth; d.setDate(d.getDate() + 1)) {
      monthDates.push(new Date(d));
    }
    return monthDates;
  }

  getHalfYearDates(date = new Date()) {
    const startMonth = date.getMonth() < 6 ? 0 : 6;
    const startDate = new Date(date.getFullYear(), startMonth, 1);
    const endDate = new Date(date.getFullYear(), startMonth + 6, 0);

    const halfYearDates = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      halfYearDates.push(new Date(d));
    }
    return halfYearDates;
  }

  getYearDates(date = new Date()) {
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const endOfYear = new Date(date.getFullYear(), 11, 31);

    const yearDates = [];
    for (let d = new Date(startOfYear); d <= endOfYear; d.setDate(d.getDate() + 1)) {
      yearDates.push(new Date(d));
    }
    return yearDates;
  }

  formatDate(date) {
    return date.toISOString().split('T')[0];
  }
}
