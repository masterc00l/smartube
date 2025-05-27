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