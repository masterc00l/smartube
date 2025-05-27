// This script runs on YouTube pages
console.log('SmartTube extension loaded');
console.log('Content script loaded');

// Function to get video information from the current page
function getVideoInfo() {
  console.log('getVideoInfo called');
  try {
    // Get video ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const videoId = urlParams.get('v');
    console.log('Video ID from URL:', videoId);
    
    if (!videoId) {
      console.error('No video ID found in URL');
      return { error: 'No video ID found in URL' };
    }

    // Get video title
    const videoTitle = document.querySelector('h1.title.style-scope.ytd-video-primary-info-renderer')?.textContent.trim();
    console.log('Video title:', videoTitle);

    // Get video description
    const videoDescription = document.querySelector('#description-inline-expander')?.textContent.trim() || 
                           document.querySelector('#description')?.textContent.trim();
    console.log('Video description:', videoDescription);

    if (!videoTitle) {
      console.error('Could not find video title');
      return { error: 'Could not find video title' };
    }

    return {
      videoId,
      videoTitle,
      videoDescription: videoDescription || 'No description available'
    };
  } catch (error) {
    console.error('Error in getVideoInfo:', error);
    return { error: error.message };
  }
}

// Function to get video information from search results
function getSearchResults() {
  const videos = Array.from(document.querySelectorAll('ytd-video-renderer')).map(video => {
    const titleElement = video.querySelector('#video-title');
    const channelElement = video.querySelector('#channel-name');
    const videoId = titleElement?.href?.split('v=')[1]?.split('&')[0];
    
    return {
      videoId,
      title: titleElement?.textContent?.trim() || '',
      channel: channelElement?.textContent?.trim() || ''
    };
  }).filter(video => video.videoId);

  return videos;
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received:', request);
  
  if (request.action === 'ping') {
    console.log('Ping received, sending pong');
    sendResponse({ status: 'pong' });
    return true;
  }
  
  if (request.action === 'getVideoInfo') {
    console.log('getVideoInfo request received');
    const videoInfo = getVideoInfo();
    console.log('Sending video info:', videoInfo);
    sendResponse(videoInfo);
    return true;
  } else if (request.action === 'getSearchResults') {
    sendResponse(getSearchResults());
  }
  return true; // Keep the message channel open for async response
});

// Notify that the content script is loaded and ready
console.log('SmartTube content script is ready'); 