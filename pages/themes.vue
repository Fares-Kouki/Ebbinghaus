<template>
  <div class="themes-manager">
    <header class="page-header">
      <h1>🎨 Gestionnaire de Thèmes</h1>
      <p>Configurez les thèmes d'apprentissage pour votre système Ebbinghaus</p>
    </header>

    <!-- Ajouter un nouveau thème -->
    <div class="add-theme-section">
      <h2>➕ Ajouter un nouveau thème</h2>
      
      <form @submit.prevent="addNewTheme" class="add-theme-form">
        <div class="form-group">
          <label for="themeId">ID du thème:</label>
          <input 
            v-model="newTheme.id" 
            id="themeId" 
            type="text" 
            placeholder="ex: gaming, music, science..."
            required
          />
        </div>
        
        <div class="form-group">
          <label for="themeName">Nom d'affichage:</label>
          <input 
            v-model="newTheme.name" 
            id="themeName" 
            type="text" 
            placeholder="ex: 🎮 Gaming, 🎵 Musique..."
            required
          />
        </div>
        
        <div class="form-group">
          <label for="themeDescription">Description:</label>
          <input 
            v-model="newTheme.description" 
            id="themeDescription" 
            type="text" 
            placeholder="Description courte du thème"
          />
        </div>
        
        <div class="form-group">
          <label for="promptTemplate">Template de prompt:</label>
          <textarea 
            v-model="newTheme.prompt_template" 
            id="promptTemplate" 
            placeholder="ex: Un fait intéressant sur l'histoire du gaming ou des jeux vidéo"
            required
          ></textarea>
          <small>Utilisez {year} pour inclure l'année dans le prompt</small>
        </div>
        
        <button type="submit" class="add-btn" :disabled="loading">
          {{ loading ? 'Ajout...' : 'Ajouter le thème' }}
        </button>
      </form>
    </div>

    <!-- Liste des thèmes existants -->
    <div class="themes-list-section">
      <h2>📋 Thèmes configurés ({{ themes.length }})</h2>
      
      <div v-if="loading" class="loading">Chargement des thèmes...</div>
      
      <div v-else-if="themes.length === 0" class="no-themes">
        Aucun thème configuré
      </div>
      
      <div v-else class="themes-grid">
        <div 
          v-for="theme in themes" 
          :key="theme.id" 
          class="theme-card"
          :class="{ inactive: !theme.active }"
        >
          <div class="theme-header">
            <h3>{{ theme.name }}</h3>
            <div class="theme-actions">
              <button 
                @click="toggleTheme(theme.id)" 
                class="toggle-btn"
                :class="{ active: theme.active }"
              >
                {{ theme.active ? '✅' : '❌' }}
              </button>
              <button @click="deleteTheme(theme.id)" class="delete-btn">🗑️</button>
            </div>
          </div>
          
          <p class="theme-description">{{ theme.description }}</p>
          <div class="theme-prompt">
            <strong>Prompt:</strong> {{ theme.prompt_template }}
          </div>
          <div class="theme-status">
            <span :class="theme.active ? 'status-active' : 'status-inactive'">
              {{ theme.active ? 'Actif' : 'Inactif' }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Messages -->
    <div v-if="message" class="message" :class="messageType">
      {{ message }}
    </div>

    <!-- Navigation -->
    <nav class="bottom-nav">
      <button @click="$router.push('/')">← Retour à l'accueil</button>
      <button @click="refreshThemes">🔄 Actualiser</button>
    </nav>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

// État réactif
const themes = ref([]);
const loading = ref(false);
const message = ref('');
const messageType = ref('');

const newTheme = ref({
  id: '',
  name: '',
  description: '',
  prompt_template: '',
  active: true
});

// Charger les thèmes au montage
onMounted(() => {
  loadThemes();
});

// Fonctions
const loadThemes = async () => {
  loading.value = true;
  try {
    const response = await $fetch('/api/themes');
    if (response.success) {
      themes.value = response.themes || [];
      console.log(`📋 Thèmes chargés: ${themes.value.length}`);
    }
  } catch (error) {
    showMessage('Erreur lors du chargement des thèmes: ' + error.message, 'error');
  } finally {
    loading.value = false;
  }
};

const addNewTheme = async () => {
  if (!newTheme.value.id || !newTheme.value.name || !newTheme.value.prompt_template) {
    showMessage('Veuillez remplir tous les champs obligatoires', 'error');
    return;
  }

  loading.value = true;
  try {
    const response = await $fetch('/api/themes', {
      method: 'POST',
      body: {
        action: 'add',
        theme: { ...newTheme.value }
      }
    });

    if (response.success) {
      showMessage(response.message, 'success');
      
      // Réinitialiser le formulaire
      newTheme.value = {
        id: '',
        name: '',
        description: '',
        prompt_template: '',
        active: true
      };
      
      // Recharger les thèmes
      await loadThemes();
    } else {
      showMessage(response.error || 'Erreur lors de l\'ajout', 'error');
    }
  } catch (error) {
    showMessage('Erreur: ' + error.message, 'error');
  } finally {
    loading.value = false;
  }
};

const toggleTheme = async (themeId) => {
  try {
    const response = await $fetch('/api/themes', {
      method: 'POST',
      body: {
        action: 'toggle',
        themeId: themeId
      }
    });

    if (response.success) {
      showMessage(response.message, 'success');
      await loadThemes();
    } else {
      showMessage(response.error || 'Erreur lors du basculement', 'error');
    }
  } catch (error) {
    showMessage('Erreur: ' + error.message, 'error');
  }
};

const deleteTheme = async (themeId) => {
  if (!confirm('Êtes-vous sûr de vouloir supprimer ce thème ?')) {
    return;
  }

  try {
    const response = await $fetch('/api/themes', {
      method: 'POST',
      body: {
        action: 'delete',
        themeId: themeId
      }
    });

    if (response.success) {
      showMessage(response.message, 'success');
      await loadThemes();
    } else {
      showMessage(response.error || 'Erreur lors de la suppression', 'error');
    }
  } catch (error) {
    showMessage('Erreur: ' + error.message, 'error');
  }
};

const refreshThemes = () => {
  loadThemes();
};

const showMessage = (text, type) => {
  message.value = text;
  messageType.value = type;
  setTimeout(() => {
    message.value = '';
    messageType.value = '';
  }, 5000);
};
</script>

<style scoped>
.themes-manager {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: 'Segoe UI', sans-serif;
}

.page-header {
  text-align: center;
  margin-bottom: 40px;
}

.page-header h1 {
  color: #2c3e50;
  margin-bottom: 10px;
}

.page-header p {
  color: #7f8c8d;
  font-size: 1.1em;
}

.add-theme-section {
  background: #f8f9fa;
  padding: 30px;
  border-radius: 12px;
  margin-bottom: 40px;
}

.add-theme-form {
  max-width: 600px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
  color: #2c3e50;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 12px;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  font-size: 16px;
}

.form-group textarea {
  height: 80px;
  resize: vertical;
}

.form-group small {
  color: #6c757d;
  font-size: 14px;
}

.add-btn {
  background: #007bff;
  color: white;
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.add-btn:hover:not(:disabled) {
  background: #0056b3;
}

.add-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.themes-list-section h2 {
  color: #2c3e50;
  margin-bottom: 20px;
}

.themes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 20px;
}

.theme-card {
  background: white;
  border: 2px solid #e9ecef;
  border-radius: 12px;
  padding: 20px;
  transition: border-color 0.3s;
}

.theme-card.inactive {
  opacity: 0.7;
  border-color: #dee2e6;
}

.theme-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.theme-header h3 {
  margin: 0;
  color: #2c3e50;
}

.theme-actions {
  display: flex;
  gap: 10px;
}

.toggle-btn, .delete-btn {
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.toggle-btn.active {
  background: #d4edda;
}

.toggle-btn:not(.active) {
  background: #f8d7da;
}

.delete-btn {
  background: #f8d7da;
  color: #721c24;
}

.delete-btn:hover {
  background: #f1aeb5;
}

.theme-description {
  color: #6c757d;
  margin-bottom: 10px;
}

.theme-prompt {
  background: #f8f9fa;
  padding: 10px;
  border-radius: 6px;
  font-size: 14px;
  margin-bottom: 10px;
}

.theme-status {
  text-align: right;
}

.status-active {
  color: #28a745;
  font-weight: bold;
}

.status-inactive {
  color: #dc3545;
  font-weight: bold;
}

.loading, .no-themes {
  text-align: center;
  padding: 40px;
  color: #6c757d;
  font-size: 1.1em;
}

.message {
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 15px 25px;
  border-radius: 8px;
  z-index: 1000;
  font-weight: bold;
}

.message.success {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.message.error {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f1aeb5;
}

.bottom-nav {
  margin-top: 40px;
  text-align: center;
  display: flex;
  gap: 20px;
  justify-content: center;
}

.bottom-nav button {
  padding: 12px 24px;
  border: 2px solid #007bff;
  border-radius: 8px;
  background: white;
  color: #007bff;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.3s;
}

.bottom-nav button:hover {
  background: #007bff;
  color: white;
}
</style>