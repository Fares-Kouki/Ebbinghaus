<template>
  <div style="padding: 20px; font-family: monospace;">
    <h1>Debug - Données stockées</h1>
    
    <div style="margin: 20px 0;">
      <h3>LocalStorage - Learning Data:</h3>
      <pre style="background: #f5f5f5; padding: 10px; overflow: auto; max-height: 300px;">{{ learningData }}</pre>
    </div>

    <div style="margin: 20px 0;">
      <h3>Test API Direct:</h3>
      <button @click="testAPI" style="padding: 10px; background: #007bff; color: white; border: none; border-radius: 4px;">
        Tester API Claude
      </button>
      <pre style="background: #f5f5f5; padding: 10px; margin-top: 10px; max-height: 200px; overflow: auto;">{{ apiResult }}</pre>
    </div>

    <div style="margin: 20px 0;">
      <button @click="clearStorage" style="padding: 10px; background: #dc3545; color: white; border: none; border-radius: 4px;">
        Vider le localStorage
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const learningData = ref('');
const apiResult = ref('');

onMounted(() => {
  loadLocalStorageData();
});

const loadLocalStorageData = () => {
  if (typeof window !== 'undefined') {
    const data = localStorage.getItem('ebbinghaus_learning_data');
    learningData.value = data ? JSON.stringify(JSON.parse(data), null, 2) : 'Aucune donnée trouvée';
  }
};

const testAPI = async () => {
  try {
    apiResult.value = 'Test en cours...';
    const response = await $fetch('/api/generate-content', {
      method: 'POST',
      body: {
        prompt: 'Test simple: donne-moi un fait historique sur l\'Égypte au format: Titre: [titre] Date: [date] Description: [description] Importance: [importance]',
        uniqueKey: 'debug_test'
      }
    });
    
    apiResult.value = JSON.stringify(response, null, 2);
  } catch (error) {
    apiResult.value = 'Erreur: ' + error.message;
  }
};

const clearStorage = () => {
  if (typeof window !== 'undefined') {
    localStorage.clear();
    learningData.value = 'Stockage vidé';
  }
};
</script>