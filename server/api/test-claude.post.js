export default defineEventHandler(async (event) => {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    
    console.log('Test API Claude avec clé:', apiKey.substring(0, 20) + '...');
    
    const response = await $fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: {
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 100,
        messages: [
          {
            role: "user",
            content: "Dis juste 'Test API Claude réussi' en français."
          }
        ]
      }
    });

    console.log('Réponse complète Claude:', JSON.stringify(response, null, 2));
    
    if (response.content && response.content[0]) {
      return {
        success: true,
        message: response.content[0].text,
        fullResponse: response
      };
    } else {
      return {
        success: false,
        error: 'Format de réponse inattendu',
        fullResponse: response
      };
    }

  } catch (error) {
    console.error('Erreur test API Claude:', error);
    return {
      success: false,
      error: error.message,
      details: error
    };
  }
});