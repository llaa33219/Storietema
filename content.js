// Entry Background Extension Content Script

// Global error handler for extension context invalidation
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && typeof event.reason === 'object' && event.reason.message) {
    if (event.reason.message.includes('Extension context invalidated') ||
        event.reason.message.includes('message port closed') ||
        event.reason.message.includes('Receiving end does not exist')) {
      // Silently handle extension reload scenarios
      event.preventDefault();
      return;
    }
  }
});

// Global error handler for runtime errors
window.addEventListener('error', (event) => {
  if (event.error && event.error.message) {
    if (event.error.message.includes('Extension context invalidated') ||
        event.error.message.includes('message port closed') ||
        event.error.message.includes('Receiving end does not exist')) {
      // Silently handle extension reload scenarios
      event.preventDefault();
      return;
    }
  }
});

let backgroundElement = null;
let musicControlElement = null;
let isInitialized = false;
let progressUpdateInterval = null;
let currentUrl = window.location.href;
let urlObserver = null;
let currentAudioState = {
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0.5,
  musicTitle: '배경음악 없음'
};

// Settings storage keys - Updated to match popup.js multi-selection system
const STORAGE_KEYS = {
  BACKGROUNDS: 'entry_backgrounds',
  MUSIC_ITEMS: 'entry_music_items',
  ACTIVE_BACKGROUND: 'entry_active_background',
  ACTIVE_MUSIC: 'entry_active_music',
  MUSIC_ENABLED: 'entry_music_enabled',
  MUSIC_VOLUME: 'entry_music_volume'
};

// Check if current URL is in the Entry Story community
function isEntryStoryPage() {
  const url = window.location.href;
  return url.includes('playentry.org/community/entrystory') || 
         url.includes('playentry.org/community/entrystory/');
}

// Clean up existing elements
function cleanup() {
  try {
    console.log('🧹 Cleaning up extension elements...');
    
    // Remove background element
    if (backgroundElement && backgroundElement.parentNode) {
      backgroundElement.parentNode.removeChild(backgroundElement);
      backgroundElement = null;
    }
    
    // Remove music controls
    if (musicControlElement && musicControlElement.parentNode) {
      musicControlElement.parentNode.removeChild(musicControlElement);
      musicControlElement = null;
    }
    
    // Stop progress updater
    if (progressUpdateInterval) {
      clearInterval(progressUpdateInterval);
      progressUpdateInterval = null;
    }
    
    // Reset state
    isInitialized = false;
    
    console.log('🧹 Cleanup completed');
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}

// Detect URL changes and reinitialize if needed
function setupUrlChangeDetection() {
  // Method 1: Listen for popstate events (back/forward navigation)
  window.addEventListener('popstate', handleUrlChange);
  
  // Method 2: Override pushState and replaceState to catch programmatic navigation
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  
  history.pushState = function(...args) {
    originalPushState.apply(this, args);
    setTimeout(handleUrlChange, 10); // Small delay to ensure DOM is updated
  };
  
  history.replaceState = function(...args) {
    originalReplaceState.apply(this, args);
    setTimeout(handleUrlChange, 10);
  };
  
  // Method 3: MutationObserver for DOM changes that might indicate navigation
  if (!urlObserver) {
    urlObserver = new MutationObserver((mutations) => {
      // Check if URL changed without a full page reload
      if (currentUrl !== window.location.href) {
        handleUrlChange();
      }
    });
    
    // Observe changes to the entire document
    urlObserver.observe(document, {
      childList: true,
      subtree: true
    });
  }
  
  // Method 4: Periodic check as fallback
  setInterval(() => {
    if (currentUrl !== window.location.href) {
      handleUrlChange();
    }
  }, 500); // Check every 500ms instead of 1000ms for better responsiveness
}

// Handle URL changes
function handleUrlChange() {
  const newUrl = window.location.href;
  console.log(`🔄 URL changed from ${currentUrl} to ${newUrl}`);
  currentUrl = newUrl;
  
  const shouldBeActive = isEntryStoryPage();
  
  if (shouldBeActive && !isInitialized) {
    console.log('🟢 Entering Entry Story page - initializing extension');
    // Small delay to ensure DOM is ready
    setTimeout(() => {
      init();
    }, 100);
  } else if (!shouldBeActive && isInitialized) {
    console.log('🔴 Leaving Entry Story page - cleaning up extension');
    cleanup();
    stopBackgroundAudio();
  } else if (shouldBeActive && isInitialized) {
    console.log('🔄 Already on Entry Story page but URL changed - reinitializing');
    cleanup();
    setTimeout(() => {
      init();
    }, 100);
  }
}

// Send message to background to play audio
async function playBackgroundAudio(url, type, volume = 0.5) {
  try {
    // Check if extension context is still valid
    if (!chrome.runtime || !chrome.runtime.sendMessage) {
      console.log('Extension context invalidated, cannot start audio');
      return false;
    }

    if (!url) {
      console.log('No URL provided for background audio');
      return false;
    }

    console.log(`🎶 Content: playBackgroundAudio called with:`, { url: url ? url.substring(0, 50) + '...' : 'no url', type, volume });
    
    const response = await chrome.runtime.sendMessage({
      action: 'playAudio',
      url: url,
      type: type,
      volume: volume
    });
    
    console.log(`🎶 Content: playBackgroundAudio response:`, response);
    
    if (response && response.success === true) {
      console.log('Background audio started successfully');
      currentAudioState.isPlaying = true;
      return true;
    } else {
      const errorMsg = response?.error || 'Unknown error';
      console.error('Failed to start background audio:', errorMsg);
      return false;
    }
  } catch (error) {
    if (error.message && (error.message.includes('Extension context invalidated') || error.message.includes('message port closed'))) {
      console.log('🔄 Extension reloading - cannot start audio');
      return false;
    } else {
      console.error('Error playing background audio:', error);
      return false;
    }
  }
}

// Send message to background to set volume
async function setBackgroundVolume(volume) {
  try {
    // Check if extension context is still valid
    if (!chrome.runtime || !chrome.runtime.sendMessage) {
      console.log('Extension context invalidated, cannot set volume');
      return false;
    }

    console.log(`Setting background volume to: ${volume}`);
    
    const response = await chrome.runtime.sendMessage({
      action: 'setVolume',
      volume: volume
    });
    
    if (response && response.success === true) {
      console.log('Background audio volume set successfully');
      return true;
    } else {
      const errorMsg = response?.error || 'Unknown error';
      // Don't log error if it's just "No offscreen document" - this means no audio is playing
      if (!errorMsg.includes('No offscreen document')) {
        console.error('Failed to set background audio volume:', errorMsg);
      }
      return false;
    }
  } catch (error) {
    if (error.message && (error.message.includes('Extension context invalidated') || error.message.includes('message port closed'))) {
      console.log('🔄 Extension reloading - cannot set volume');
      return false;
    } else {
      console.error('Error setting background volume:', error);
      return false;
    }
  }
}

// Initialize extension when page loads
function init() {
  try {
    if (isInitialized) {
      console.log('Extension already initialized, skipping');
      return;
    }
    
    // Check if we're on the correct page
    if (!isEntryStoryPage()) {
      console.log('Not on Entry Story page, skipping initialization');
      return;
    }
    
    console.log('🚀 Initializing Entry Background Extension...');
    
    // Wait for DOM elements to be available with retry logic
    const waitForElements = (retries = 10) => {
      // Selectors for different page types
      const selectors = {
        // Entry Story List page (/community/entrystory)
        list: {
          musicAnchor: 'label.css-1mgwbs1.eq36rvw1',
          backgroundTarget: 'div.css-1cnivlj.e18x7bg08',
          backgroundParent: 'div.css-1cnivlj.e18x7bg08'
        },
        // Entry Story View page (/community/entrystory/ID)
        view: {
          musicAnchor: 'div.css-1eth5pr.e1yi8oq65 h2',
          backgroundTarget: 'div.css-1cnivlj',
          backgroundParent: 'div.css-1cnivlj'
        }
      };

      let musicAnchor, backgroundTarget, backgroundParent;
      let pageType = null;

      // Try view page selectors first
      musicAnchor = document.querySelector(selectors.view.musicAnchor);
      backgroundTarget = document.querySelector(selectors.view.backgroundTarget);
      backgroundParent = document.querySelector(selectors.view.backgroundParent);
      if (musicAnchor && backgroundTarget) {
        pageType = 'view';
        console.log('✅ Detected Entry Story View page structure');
      } else {
        // Fallback to list page selectors
        musicAnchor = document.querySelector(selectors.list.musicAnchor);
        backgroundTarget = document.querySelector(selectors.list.backgroundTarget);
        backgroundParent = document.querySelector(selectors.list.backgroundParent);
        if (musicAnchor && backgroundTarget) {
          pageType = 'list';
          console.log('✅ Detected Entry Story List page structure');
        }
      }
      
      if (pageType && musicAnchor && backgroundTarget) {
        console.log(`✅ Target elements found (type: ${pageType}), proceeding with initialization`);
        
        // Remove background styles from target div
        removeOriginalStyles(backgroundTarget);
        
        // Add music controls
        addMusicControls(musicAnchor, pageType);
        
        // Add background element
        addBackgroundElement(backgroundParent);
        
        // Load saved settings
        loadSettings();
        
        isInitialized = true;
        console.log('🎉 Entry Background Extension initialized successfully');
      } else if (retries > 0) {
        console.log(`⏳ Target elements not found, retrying... (${retries} attempts left)`);
        setTimeout(() => waitForElements(retries - 1), 200);
      } else {
        console.warn('❌ Could not find target elements after multiple attempts');
      }
    };
    
    waitForElements();
  } catch (error) {
    console.error('Error initializing Entry Background Extension:', error);
  }
}

// Remove original background styles
function removeOriginalStyles(targetDiv) {
  try {
    if (targetDiv) {
      targetDiv.style.background = 'none';
      targetDiv.style.backgroundColor = 'transparent';
      targetDiv.style.backgroundImage = 'none';
      targetDiv.style.boxShadow = 'none';
    } else {
      console.warn('No target div provided for style removal');
    }
  } catch (error) {
    console.error('Error removing original styles:', error);
  }
}

// Add music controls next to the label
function addMusicControls(anchorElement, pageType) {
  try {
    if (musicControlElement || !anchorElement) return;
    
    musicControlElement = document.createElement('div');
    musicControlElement.id = 'entry-music-controls';
    musicControlElement.innerHTML = `
      <div class="music-display" id="music-display">
        <svg class="music-icon" width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" fill="currentColor"/>
        </svg>
        <div class="music-info">
          <div class="music-title" id="music-title">배경음악 없음</div>
          <div class="music-status" id="music-status">정지됨</div>
        </div>
      </div>
    `;
    
    if (pageType === 'view') {
      // On view page, insert after the h2 title
      anchorElement.parentNode.insertBefore(musicControlElement, anchorElement.nextSibling);
    } else {
      // On list page, insert before the label
      anchorElement.parentNode.insertBefore(musicControlElement, anchorElement);
    }
    
    console.log(`Music display controls added (type: ${pageType})`);
  } catch (error) {
    console.error('Error adding music controls:', error);
  }
}

// Update music display
function updateMusicDisplay(title, isPlaying) {
  try {
    const musicTitle = document.getElementById('music-title');
    const musicStatus = document.getElementById('music-status');
    const musicDisplay = document.getElementById('music-display');
    
    if (musicTitle) {
      musicTitle.textContent = title || '배경음악 없음';
    }
    
    if (musicStatus) {
      musicStatus.textContent = isPlaying ? '재생 중' : '정지됨';
    }
    
    if (musicDisplay) {
      musicDisplay.className = isPlaying ? 'music-display playing' : 'music-display stopped';
    }
  } catch (error) {
    console.error('Error updating music display:', error);
  }
}

// Show music display
function showMusicDisplay() {
  try {
    const musicControls = document.getElementById('entry-music-controls');
    if (musicControls) {
      musicControls.style.display = 'inline-flex';
      console.log('Music controls shown');
    }
  } catch (error) {
    console.error('Error showing music display:', error);
  }
}

// Hide music display
function hideMusicDisplay() {
  try {
    const musicControls = document.getElementById('entry-music-controls');
    if (musicControls) {
      musicControls.style.display = 'none';
      console.log('Music controls hidden');
    }
  } catch (error) {
    console.error('Error hiding music display:', error);
  }
}

// Add background element inside target div
function addBackgroundElement(parentDiv) {
  try {
    if (backgroundElement || !parentDiv) {
      console.log('Background element already exists or parent not found');
      return;
    }
    
    backgroundElement = document.createElement('div');
    backgroundElement.id = 'entry-custom-background';
    
    // Insert as the first child of the parent container to ensure it's in the back
    parentDiv.insertBefore(backgroundElement, parentDiv.firstChild);
    
    console.log('Background element added');
    
  } catch (error) {
    console.error('Error adding background element:', error);
  }
}

// Set background content
function setBackground(url, type) {
  try {
    if (!backgroundElement) {
      console.error('Background element not found');
      return;
    }
    
    console.log('Setting background:', { url, type });
    
    // Clear previous content
    backgroundElement.innerHTML = '';
    backgroundElement.style.backgroundImage = 'none';

    if (type === 'image') {
      // Create img element instead of using background-image for better control
      const imgElement = document.createElement('img');
      imgElement.src = url;
      imgElement.alt = 'Background Image';
      imgElement.onerror = () => {
        console.error('Failed to load background image:', url);
      };
      imgElement.onload = () => {
        console.log('Background image loaded successfully');
      };
      backgroundElement.appendChild(imgElement);
    } else if (type === 'video' || type === 'youtube') {
      let videoElement;
      
      if (type === 'youtube') {
        videoElement = document.createElement('iframe');
        const videoId = extractYouTubeId(url);
        if (videoId) {
          // Use youtube-nocookie for better privacy and ensure autoplay with muted
          videoElement.src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0&playsinline=1&iv_load_policy=3&modestbranding=1`;
          videoElement.setAttribute('frameborder', '0');
          videoElement.setAttribute('allow', 'autoplay; encrypted-media');
          videoElement.setAttribute('title', 'YouTube Background Video');
          console.log('YouTube background iframe created');
        } else {
          console.error('Could not extract YouTube video ID from:', url);
          return;
        }
      } else {
        videoElement = document.createElement('video');
        videoElement.src = url;
        videoElement.autoplay = true;
        videoElement.loop = true;
        videoElement.muted = true; // Videos must be muted to autoplay
        videoElement.playsInline = true; // For iOS compatibility
        console.log('Video element created');
      }
      
      if (videoElement) {
        backgroundElement.appendChild(videoElement);
        console.log('Video/iframe added to background element');
      }
    } else if (type === 'none') {
      // Background is already cleared
      console.log('Background cleared');
    }
    
  } catch (error) {
    console.error('Error setting background:', error);
  }
}

// Extract YouTube video ID
function extractYouTubeId(url) {
  try {
    // Check if URL contains YouTube domain
    if (!url || typeof url !== 'string') {
      return null;
    }
    
    // Check if it's a YouTube URL
    if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
      return null;
    }
    
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  } catch (error) {
    console.error('Error extracting YouTube ID:', error);
    return null;
  }
}

// Listen for messages from background and popup
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  try {
    // Check if extension context is still valid
    if (!chrome.runtime || !chrome.runtime.sendMessage) {
      console.warn('Extension context invalidated, cannot process message');
      sendResponse({success: false, error: 'Extension context invalidated'});
      return;
    }

    console.log('Content script received message:', request);
    
    if (request.action === 'updateBackground') {
      setBackground(request.url, request.type);
    } else if (request.action === 'updateMusic') {
      const volume = request.volume || 0.5;
      
      // 디버깅: 받은 데이터 확인
      console.log('🎵 updateMusic received:', {
        enabled: request.enabled,
        url: request.url ? request.url.substring(0, 50) + '...' : 'NO URL',
        type: request.type,
        musicTitle: request.musicTitle,
        volume: request.volume
      });
      
      // ALWAYS stop existing audio first when updating music
      console.log('🎵 Music update requested - stopping existing audio first...');
      stopBackgroundAudio();
      
      // Longer delay to ensure COMPLETE cleanup (especially for Web Audio API)
      await new Promise(resolve => setTimeout(resolve, 300)); // Increased from 100ms to 300ms
      
      // Check if music should be stopped or started
      if (request.enabled === false || !request.url || request.url.trim() === '') {
        console.log('Music disabled or no URL - keeping audio stopped');
        currentAudioState.musicTitle = '배경음악 없음';
        currentAudioState.isPlaying = false;
        hideMusicDisplay();
        updateMusicDisplay('배경음악 없음', false);
      } else {
        // Update music title for valid music
        if (request.musicTitle && request.musicTitle.trim() !== '') {
          // popup.js에서 전달된 제목 사용
          currentAudioState.musicTitle = request.musicTitle;
          console.log('🎵 Using title from popup:', request.musicTitle);
        } else {
          // URL에서 제목 추출
          currentAudioState.musicTitle = extractMusicTitle(request.url);
          console.log('🎵 Extracted title from URL:', currentAudioState.musicTitle);
        }
        
        console.log('Starting new background audio after cleanup delay...');
        console.log('🎵 Final music title:', currentAudioState.musicTitle);
        
        // Show display with loading state
        updateMusicDisplay(currentAudioState.musicTitle, false); // Show title but not playing yet
        showMusicDisplay();
        
        const success = await playBackgroundAudio(request.url, request.type, volume);
        if (success) {
          console.log('🎵 Audio started successfully, updating to playing state');
          currentAudioState.isPlaying = true;
          updateMusicDisplay(currentAudioState.musicTitle, true);
        } else {
          console.log('🎵 Audio failed to start, keeping stopped state');
          currentAudioState.isPlaying = false;
          updateMusicDisplay(currentAudioState.musicTitle, false);
        }
      }
    } else if (request.action === 'notifyContent') {
      // Handle messages from offscreen document
      handleOffscreenNotification(request.event, request.data);
    }
    
    sendResponse({success: true});
  } catch (error) {
    console.error('Error handling content script message:', error);
    sendResponse({success: false, error: error.message});
  }
});

// Handle notifications from offscreen document
function handleOffscreenNotification(event, data) {
  try {
    switch (event) {
      case 'audioStarted':
        currentAudioState.duration = data.duration;
        currentAudioState.currentTime = data.currentTime;
        currentAudioState.isPlaying = true;
        // Show music display when audio starts and update with current title
        showMusicDisplay();
        updateMusicDisplay(currentAudioState.musicTitle, true);
        console.log('🎵 Audio started event - Title:', currentAudioState.musicTitle, 'Playing:', true);
        break;
        
      case 'progressUpdate':
        currentAudioState.currentTime = data.currentTime;
        currentAudioState.duration = data.duration;
        currentAudioState.isPlaying = !data.paused;
        break;
        
      case 'audioPaused':
        currentAudioState.isPlaying = false;
        updateMusicDisplay(currentAudioState.musicTitle, false);
        break;
        
      case 'audioResumed':
        currentAudioState.isPlaying = true;
        updateMusicDisplay(currentAudioState.musicTitle, true);
        break;
        
      case 'audioStopped':
        currentAudioState.isPlaying = false;
        currentAudioState.currentTime = 0;
        currentAudioState.duration = 0;
        currentAudioState.musicTitle = '배경음악 없음';
        // Hide music display when audio stops
        hideMusicDisplay();
        updateMusicDisplay('배경음악 없음', false);
        break;
        
      case 'debugMessage':
        // Show debug messages from offscreen document
        if (data && data.message) {
          console.log(`🔍 [Offscreen Debug] ${data.message}`);
        }
        break;
    }
  } catch (error) {
    console.error('Error handling offscreen notification:', error);
  }
}

// Check every 0.5 seconds if we need to initialize
// Also check when page is loaded/refreshed
window.addEventListener('beforeunload', () => {
  try {
    console.log('Page unloading, stopping background audio');
    stopBackgroundAudio();
  } catch (error) {
    // Silent fail during page unload is acceptable - especially for extension context issues
    if (error.message && (error.message.includes('Extension context invalidated') || 
                         error.message.includes('message port closed') ||
                         error.message.includes('Receiving end does not exist'))) {
      // Silently handle extension reload scenarios during page unload
      return;
    } else {
      console.warn('Error during page unload:', error.message);
    }
  }
});

// Check on page visibility change (tab switching)
document.addEventListener('visibilitychange', () => {
  try {
    if (document.hidden) {
      console.log('Page hidden, music continues in background');
    } else {
      console.log('Page visible, checking music settings');
      // Only reload settings if we're on the right page and initialized
      if (isEntryStoryPage() && isInitialized) {
        // Give a small delay to ensure UI is ready
        setTimeout(() => {
          try {
            // Check if extension context is still valid before accessing storage
            if (!chrome.storage || !chrome.storage.local || !chrome.runtime) {
              // Silently return - extension context invalidated
              return;
            }
            
            // Check for existing runtime errors
            if (chrome.runtime.lastError) {
              // Silently return - runtime error detected
              return;
            }
            
            // Re-check settings to ensure they're current
            chrome.storage.local.get([STORAGE_KEYS.MUSIC_ENABLED], (result) => {
              // Check for Chrome runtime errors
              if (chrome.runtime.lastError) {
                // Silently handle - extension might be reloading
                return;
              }
              
              if (result[STORAGE_KEYS.MUSIC_ENABLED] === false) {
                console.log('Music disabled on tab return, stopping audio');
                stopBackgroundAudio();
              }
            });
          } catch (error) {
            // Handle extension context invalidation silently - this is normal during reload
            if (error.message && (error.message.includes('Extension context invalidated') || 
                                 error.message.includes('message port closed'))) {
              // Silently handle extension reload - no need to warn users
              return;
            } else {
              console.error('Error checking music settings on visibility change:', error);
            }
          }
        }, 500);
      }
    }
  } catch (error) {
    // Handle extension context errors silently during visibility changes
    if (error.message && (error.message.includes('Extension context invalidated') || 
                         error.message.includes('message port closed') ||
                         error.message.includes('Receiving end does not exist'))) {
      // Silently handle extension reload scenarios during visibility change
      return;
    } else {
      console.warn('Error during visibility change:', error.message);
    }
  }
});

// Initialize when DOM is ready - with enhanced error handling
try {
  // Wait for DOM to be ready before any initialization
  const initializeWhenReady = () => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        try {
          console.log('🚀 DOM loaded, starting URL change detection and initial check');
          setupUrlChangeDetection();
          handleUrlChange(); // Initial check
        } catch (error) {
          console.error('Error during DOMContentLoaded init:', error);
        }
      });
    } else {
      console.log('🚀 DOM already ready, starting URL change detection and initial check');
      setupUrlChangeDetection();
      handleUrlChange(); // Initial check
    }
  };
  
  initializeWhenReady();
} catch (error) {
  console.error('Error setting up DOM ready listener:', error);
}

// Stop progress updater
function stopProgressUpdater() {
  if (progressUpdateInterval) {
    clearInterval(progressUpdateInterval);
    progressUpdateInterval = null;
  }
}

// Send message to background to stop audio completely
async function stopBackgroundAudio() {
  try {
    // Check if extension context is still valid
    if (!chrome.runtime || !chrome.runtime.sendMessage) {
      // Extension context invalidated - handle silently
      console.log('Extension context invalidated, cleaning up local audio state');
      // Still update local state
      currentAudioState.isPlaying = false;
      currentAudioState.currentTime = 0;
      currentAudioState.duration = 0;
      updateMusicDisplay('배경음악 없음', false);
      return true; // Return true since we've handled the cleanup locally
    }

    // Check if runtime is still connected
    if (chrome.runtime.lastError) {
      console.log('Chrome runtime error detected, handling cleanup locally');
      currentAudioState.isPlaying = false;
      currentAudioState.currentTime = 0;
      currentAudioState.duration = 0;
      updateMusicDisplay('배경음악 없음', false);
      return true;
    }

    const response = await chrome.runtime.sendMessage({
      action: 'stopAudio'
    });
    
    if (response && response.success === true) {
      console.log('Background audio stopped');
      currentAudioState.isPlaying = false;
      currentAudioState.currentTime = 0;
      currentAudioState.duration = 0;
      updateMusicDisplay('배경음악 없음', false);
      return true;
    } else {
      const errorMsg = response?.error || 'Unknown error';
      // Don't log error if it's just "No offscreen document" - this is expected when no audio is playing
      if (!errorMsg.includes('No offscreen document')) {
        console.error('Failed to stop background audio:', errorMsg);
      }
      return false;
    }
  } catch (error) {
    // Handle all extension context errors silently
    if (error.message && (error.message.includes('Extension context invalidated') ||
                         error.message.includes('message port closed') ||
                         error.message.includes('Receiving end does not exist') ||
                         error.message.includes('The message port closed before'))) {
      // Silently handle extension reload scenarios - clean up local state
      currentAudioState.isPlaying = false;
      currentAudioState.currentTime = 0;
      currentAudioState.duration = 0;
      updateMusicDisplay('배경음악 없음', false);
      return true; // Consider this successful since we've cleaned up
    } else {
      console.error('Error sending stop audio message:', error);
      return false;
    }
  }
}

// Enhanced loadSettings with better error handling - Updated for multi-selection system
function loadSettings() {
  try {
    // Check if extension context is still valid
    if (!chrome.storage || !chrome.storage.local) {
      console.log('Extension context invalidated, cannot load settings');
      return;
    }

    chrome.storage.local.get([
      STORAGE_KEYS.BACKGROUNDS,
      STORAGE_KEYS.MUSIC_ITEMS,
      STORAGE_KEYS.ACTIVE_BACKGROUND,
      STORAGE_KEYS.ACTIVE_MUSIC,
      STORAGE_KEYS.MUSIC_ENABLED,
      STORAGE_KEYS.MUSIC_VOLUME
    ], async (result) => {
      try {
        // Check for Chrome runtime errors first
        if (chrome.runtime.lastError) {
          console.log('Chrome runtime error during settings load, skipping');
          return;
        }
        
        console.log('Loaded settings:', result);
        
        // Get background and music arrays
        const backgrounds = result[STORAGE_KEYS.BACKGROUNDS] || [];
        const musicItems = result[STORAGE_KEYS.MUSIC_ITEMS] || [];
        const activeBackgroundId = result[STORAGE_KEYS.ACTIVE_BACKGROUND];
        const activeMusicId = result[STORAGE_KEYS.ACTIVE_MUSIC];
        
        // Apply active background if available
        if (activeBackgroundId && backgrounds.length > 0) {
          const activeBackground = backgrounds.find(bg => bg.id === activeBackgroundId);
          if (activeBackground) {
            console.log('Applying active background from settings');
            setBackground(activeBackground.url, activeBackground.type);
          } else {
            console.warn('Active background ID not found in backgrounds array');
          }
        } else {
          console.log('No active background or backgrounds array is empty');
        }
        
        // Handle music settings
        const musicEnabled = result[STORAGE_KEYS.MUSIC_ENABLED];
        const musicVolume = result[STORAGE_KEYS.MUSIC_VOLUME] || 0.5;
        
        if (musicEnabled === true && activeMusicId && musicItems.length > 0) {
          const activeMusic = musicItems.find(music => music.id === activeMusicId);
          if (activeMusic) {
            console.log('Music is enabled in settings, starting audio');
            
            // Set music title
            currentAudioState.musicTitle = activeMusic.name || extractMusicTitle(activeMusic.url);
            
            // Show music display since music is enabled
            showMusicDisplay();
            updateMusicDisplay(currentAudioState.musicTitle, false);
            
            // Use async IIFE to handle the async operation
            (async () => {
              try {
                console.log('Attempting to start background music...');
                const success = await playBackgroundAudio(activeMusic.url, activeMusic.type, musicVolume);
                
                if (success) {
                  console.log('Background music started successfully');
                  updateMusicDisplay(currentAudioState.musicTitle, true);
                } else {
                  console.warn('Background music failed to start');
                  updateMusicDisplay(currentAudioState.musicTitle, false);
                }
              } catch (error) {
                console.error('Error starting background music:', error);
                updateMusicDisplay(currentAudioState.musicTitle, false);
              }
            })();
          } else {
            console.warn('Active music ID not found in music items array');
            currentAudioState.musicTitle = '배경음악 없음';
            updateMusicDisplay('배경음악 없음', false);
            hideMusicDisplay();
          }
        } else if (musicEnabled === false) {
          // Stop music if explicitly disabled
          console.log('Music is disabled in settings, stopping any existing audio');
          currentAudioState.musicTitle = '배경음악 없음';
          currentAudioState.isPlaying = false;
          hideMusicDisplay();
          stopBackgroundAudio();
          updateMusicDisplay('배경음악 없음', false);
        } else {
          // Music setting not found or no active music, hide music display by default
          console.log('Music setting not found or no active music, hiding music display by default');
          currentAudioState.musicTitle = '배경음악 없음';
          currentAudioState.isPlaying = false;
          hideMusicDisplay();
          updateMusicDisplay('배경음악 없음', false);
        }
        
      } catch (error) {
        console.error('Error processing loaded settings:', error);
      }
    });
  } catch (error) {
    if (error.message && (error.message.includes('Extension context invalidated') || error.message.includes('message port closed'))) {
      console.log('🔄 Extension reloading - cannot load settings');
    } else {
      console.error('Error loading settings:', error);
    }
  }
}

// Enhanced saveSettings with better error handling
function saveSettings(backgroundsArray, musicArray, activeBackgroundId, activeMusicId, musicEnabled, musicVolume) {
  try {
    // Check if extension context is still valid
    if (!chrome.storage || !chrome.storage.local) {
      console.log('Extension context invalidated, cannot save settings');
      return;
    }

    const settings = {
      [STORAGE_KEYS.BACKGROUNDS]: backgroundsArray,
      [STORAGE_KEYS.MUSIC_ITEMS]: musicArray,
      [STORAGE_KEYS.ACTIVE_BACKGROUND]: activeBackgroundId,
      [STORAGE_KEYS.ACTIVE_MUSIC]: activeMusicId,
      [STORAGE_KEYS.MUSIC_ENABLED]: musicEnabled,
      [STORAGE_KEYS.MUSIC_VOLUME]: musicVolume
    };
    
    console.log('Saving settings:', settings);
    
    chrome.storage.local.set(settings, () => {
      if (chrome.runtime.lastError) {
        console.error('Error saving settings:', chrome.runtime.lastError);
      } else {
        console.log('Settings saved successfully');
      }
    });
  } catch (error) {
    if (error.message && (error.message.includes('Extension context invalidated') || error.message.includes('message port closed'))) {
      console.log('🔄 Extension reloading - cannot save settings');
    } else {
      console.error('Error in saveSettings:', error);
    }
  }
}

// Extract music title from URL
function extractMusicTitle(url) {
  try {
    if (!url || typeof url !== 'string') {
      console.log('🎵 extractMusicTitle: Invalid URL, returning default');
      return '배경음악';
    }
    
    console.log('🎵 extractMusicTitle: Processing URL:', url.substring(0, 50) + '...');
    
    // For YouTube URLs
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      console.log('🎵 extractMusicTitle: YouTube URL detected');
      return 'YouTube 배경음악';
    }
    
    // For regular URLs, extract filename
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split('/').pop();
    
    if (filename && filename !== '') {
      // Remove file extension
      const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
      // Decode URL encoding
      const decodedName = decodeURIComponent(nameWithoutExt);
      // Limit length
      const finalTitle = decodedName.length > 30 ? decodedName.substring(0, 30) + '...' : decodedName;
      console.log('🎵 extractMusicTitle: Extracted title:', finalTitle);
      return finalTitle;
    }
    
    console.log('🎵 extractMusicTitle: No filename found, using default');
    return '배경음악';
  } catch (error) {
    console.warn('🎵 extractMusicTitle: Error extracting music title:', error);
    return '배경음악';
  }
} 