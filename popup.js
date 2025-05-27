document.addEventListener('DOMContentLoaded', function() {
  console.log('Popup initialized');
  
  const apiKeyInput = document.getElementById('apiKey');
  const saveApiKeyButton = document.getElementById('saveApiKey');
  const mainSection = document.getElementById('mainSection');
  const searchQuery = document.getElementById('searchQuery');
  const searchButton = document.getElementById('searchButton');
  const questionInput = document.getElementById('question');
  const askQuestionButton = document.getElementById('askQuestion');
  const responseDiv = document.getElementById('response');
  const errorMessageDiv = document.getElementById('errorMessage');
  const loadingDiv = document.getElementById('loading');
  const suggestionButtons = document.querySelectorAll('.suggestion-button');

  function showError(message) {
    console.error('Error:', message);
    errorMessageDiv.textContent = message;
    errorMessageDiv.style.display = 'block';
    loadingDiv.style.display = 'none';
  }

  function showLoading() {
    console.log('Showing loading state');
    errorMessageDiv.style.display = 'none';
    loadingDiv.style.display = 'block';
  }

  function hideLoading() {
    console.log('Hiding loading state');
    loadingDiv.style.display = 'none';
  }

  // Check if API key exists
  chrome.storage.sync.get(['geminiApiKey'], function(result) {
    console.log('Checking for API key:', result);
    if (result.geminiApiKey) {
      apiKeyInput.value = result.geminiApiKey;
      mainSection.classList.remove('hidden');
    }
  });

  // Save API key
  saveApiKeyButton.addEventListener('click', function() {
    const apiKey = apiKeyInput.value.trim();
    console.log('Saving API key:', apiKey ? 'Key provided' : 'No key provided');
    if (apiKey) {
      chrome.storage.sync.set({ geminiApiKey: apiKey }, function() {
        console.log('API key saved successfully');
        mainSection.classList.remove('hidden');
        alert('API key saved successfully!');
      });
    } else {
      showError('Please enter a valid API key');
    }
  });

  // Search YouTube
  searchButton.addEventListener('click', async function() {
    const query = searchQuery.value.trim();
    console.log('Search query:', query);
    if (!query) {
      showError('Please enter a search query');
      return;
    }

    // Open YouTube search in a new tab
    chrome.tabs.create({ url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}` });
  });

  // Handle suggestion buttons
  suggestionButtons.forEach(button => {
    button.addEventListener('click', function() {
      const question = this.dataset.question;
      console.log('Selected suggestion:', question);
      questionInput.value = question;
    });
  });

  // Function to inject content script
  async function injectContentScript(tabId) {
    console.log('Attempting to inject content script into tab:', tabId);
    try {
      // First check if content script is already injected
      try {
        console.log('Checking if content script is already injected');
        await chrome.tabs.sendMessage(tabId, { action: 'ping' });
        console.log('Content script already injected');
        return true;
      } catch (error) {
        console.log('Content script not found, proceeding with injection');
      }

      console.log('Injecting content script');
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      });
      
      // Wait for content script to be ready
      let attempts = 0;
      const maxAttempts = 5;
      while (attempts < maxAttempts) {
        try {
          console.log(`Waiting for content script to be ready (attempt ${attempts + 1}/${maxAttempts})`);
          await new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(tabId, { action: 'ping' }, (response) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve(response);
              }
            });
          });
          console.log('Content script ready');
          return true;
        } catch (error) {
          attempts++;
          console.log(`Attempt ${attempts} failed:`, error);
          if (attempts === maxAttempts) {
            throw new Error('Content script failed to initialize');
          }
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    } catch (error) {
      console.error('Error injecting content script:', error);
      return false;
    }
  }

  // Function to get video information with retries
  async function getVideoInfo(tabId, maxRetries = 3) {
    console.log('Getting video information from tab:', tabId);
    for (let i = 0; i < maxRetries; i++) {
      try {
        console.log(`Attempt ${i + 1}/${maxRetries} to get video info`);
        const response = await new Promise((resolve, reject) => {
          chrome.tabs.sendMessage(tabId, { action: 'getVideoInfo' }, (response) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(response);
            }
          });
        });

        console.log('Received video info response:', response);

        if (response && response.error) {
          throw new Error(response.error);
        }

        if (response && response.videoId) {
          return response;
        }

        throw new Error('Invalid video info response');
      } catch (error) {
        console.log(`Attempt ${i + 1} failed:`, error);
        if (i === maxRetries - 1) throw error;
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    throw new Error('Failed to get video information after multiple attempts');
  }

  // Ask question
  askQuestionButton.addEventListener('click', async function() {
    const question = questionInput.value.trim();
    console.log('Question submitted:', question);
    if (!question) {
      showError('Please enter a question');
      return;
    }

    try {
      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      console.log('Current tab:', tab);

      if (!tab.url.includes('youtube.com/watch')) {
        showError('Please open a YouTube video first');
        return;
      }

      showLoading();
      responseDiv.textContent = '';

      // Inject content script
      const injected = await injectContentScript(tab.id);
      if (!injected) {
        throw new Error('Failed to inject content script');
      }

      // Get video information with retries
      const videoInfo = await getVideoInfo(tab.id);
      console.log('Video info:', videoInfo);

      if (!videoInfo || !videoInfo.videoId) {
        throw new Error('Could not get video information. Please make sure you are on a YouTube video page.');
      }

      // Get API key
      const result = await chrome.storage.sync.get(['geminiApiKey']);
      const apiKey = result.geminiApiKey;
      console.log('API key retrieved:', apiKey ? 'Key exists' : 'No key found');

      if (!apiKey) {
        throw new Error('Please save your API key first');
      }

      // Prepare the prompt
      const prompt = `You are an AI assistant analyzing a YouTube video. Here is the information about the video:
Title: ${videoInfo.videoTitle}
Description: ${videoInfo.videoDescription}

Transcript:
${videoInfo.transcript}

Question: ${question}

Please provide a detailed and helpful response based on the video information and transcript provided. If the transcript is not available, focus on the title and description.`;

      console.log('Sending prompt to Gemini:', prompt);

      // Call Gemini API
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;
      console.log('Calling Gemini API:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            }
          ]
        })
      });

      const data = await response.json();
      console.log('Gemini API response:', data);
      
      if (!response.ok) {
        console.error('API Error:', data);
        throw new Error(data.error?.message || 'API request failed');
      }

      if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
        responseDiv.textContent = data.candidates[0].content.parts[0].text;
        hideLoading();
      } else {
        console.error('Unexpected API Response:', data);
        throw new Error('Could not generate a response. Please try again.');
      }
    } catch (error) {
      console.error('Error:', error);
      showError(error.message);
    }
  });
}); 