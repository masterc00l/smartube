// Background script to handle transcript fetching
console.log('Background script loaded');

// Function to fetch transcript from YouTube
async function fetchTranscript(videoId) {
  try {
    console.log('Fetching transcript for video:', videoId);
    const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
    const html = await response.text();
    
    // Extract transcript data from the page
    const transcriptData = extractTranscriptData(html);
    if (!transcriptData) {
      throw new Error('No transcript data found');
    }

    // Format transcript for better readability
    const formattedTranscript = formatTranscript(transcriptData);
    console.log('Transcript fetched successfully');
    return formattedTranscript;
  } catch (error) {
    console.error('Error fetching transcript:', error);
    return null;
  }
}

// Function to extract transcript data from HTML
function extractTranscriptData(html) {
  try {
    // Look for transcript data in the page
    const transcriptMatch = html.match(/"captions":\s*({[^}]+})/);
    if (!transcriptMatch) {
      return null;
    }

    const transcriptData = JSON.parse(transcriptMatch[1]);
    return transcriptData;
  } catch (error) {
    console.error('Error extracting transcript data:', error);
    return null;
  }
}

// Function to format transcript for better readability
function formatTranscript(transcriptData) {
  try {
    let formattedText = '';
    const events = transcriptData.playerCaptionsTracklistRenderer.captionTracks[0].events;
    
    for (const event of events) {
      if (event.segs) {
        for (const seg of event.segs) {
          if (seg.utf8) {
            formattedText += seg.utf8 + ' ';
          }
        }
      }
    }
    
    return formattedText.trim();
  } catch (error) {
    console.error('Error formatting transcript:', error);
    return null;
  }
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background script received message:', request);
  
  if (request.action === 'getTranscript') {
    fetchTranscript(request.videoId)
      .then(transcript => {
        sendResponse({ transcript });
      })
      .catch(error => {
        sendResponse({ error: error.message });
      });
    return true; // Keep the message channel open for async response
  }
});

// Listen for when the extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  if (tab.url.includes('youtube.com/watch')) {
    // Inject the content script if it's not already injected
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
  }
});

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getVideoInfo') {
    // Forward the message to the content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'getVideoInfo' }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Error:', chrome.runtime.lastError);
            sendResponse({ error: 'Could not communicate with the page' });
          } else {
            sendResponse(response);
          }
        });
      }
    });
    return true; // Keep the message channel open for async response
  }
}); 