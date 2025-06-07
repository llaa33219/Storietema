// Entry Background Extension Content Script
let backgroundElement = null;
let musicControlElement = null;
let isInitialized = false;
let progressUpdateInterval = null;
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
    if (isInitialized) return;
    
    // Check if we're on the correct page
    if (!window.location.href.includes('playentry.org/community/entrystory/')) {
      return;
    }
    
    const targetLabel = document.querySelector('label.css-1mgwbs1.eq36rvw1');
    const targetDiv = document.querySelector('div.css-1cnivlj.e18x7bg08');
    
    if (!targetLabel || !targetDiv) {
      return;
    }
    
    // Remove background styles from target div
    removeOriginalStyles();
    
    // Add music controls
    addMusicControls(targetLabel);
    
    // Add background element
    addBackgroundElement(targetDiv);
    
    // Load saved settings
    loadSettings();
    
    isInitialized = true;
    console.log('Entry Background Extension initialized');
  } catch (error) {
    console.error('Error initializing Entry Background Extension:', error);
  }
}

// Remove original background styles
function removeOriginalStyles() {
  try {
    const targetDiv = document.querySelector('div.css-1cnivlj.e18x7bg08');
    if (targetDiv) {
      targetDiv.style.background = 'none';
      targetDiv.style.backgroundColor = 'transparent';
      targetDiv.style.backgroundImage = 'none';
      targetDiv.style.boxShadow = 'none';
    }
  } catch (error) {
    console.error('Error removing original styles:', error);
  }
}

// Add music controls next to the label
function addMusicControls(targetLabel) {
  try {
    if (musicControlElement) return;
    
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
    
    // Insert before the target label (above it)
    targetLabel.parentNode.insertBefore(musicControlElement, targetLabel);
    
    console.log('Music display controls added');
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
function addBackgroundElement(targetDiv) {
  try {
    if (backgroundElement) {
      console.log('Background element already exists');
      return;
    }
    
    // Find the css-nendku e18x7bg05 element
    const targetElement = document.querySelector('div.css-nendku.e18x7bg05');
    if (!targetElement) {
      console.warn('Target element (css-nendku e18x7bg05) not found, trying alternative selectors');
      
      // Try alternative selectors
      const alternatives = [
        'div.css-nendku',
        'div.e18x7bg05',
        'div[class*="css-nendku"]',
        'div[class*="e18x7bg05"]'
      ];
      
      let fallbackElement = null;
      for (const selector of alternatives) {
        fallbackElement = document.querySelector(selector);
        if (fallbackElement) {
          console.log(`Found alternative target element: ${selector}`);
          break;
        }
      }
      
      if (!fallbackElement) {
        console.error('No suitable target element found for background');
        return;
      }
      
      // Use fallback element
      backgroundElement = document.createElement('div');
      backgroundElement.id = 'entry-custom-background';
      fallbackElement.parentNode.insertBefore(backgroundElement, fallbackElement.nextSibling);
      console.log('Background element added after fallback element');
      return;
    }
    
    backgroundElement = document.createElement('div');
    backgroundElement.id = 'entry-custom-background';
    
    // Insert after the target element
    targetElement.parentNode.insertBefore(backgroundElement, targetElement.nextSibling);
    
    console.log('Background element added after css-nendku e18x7bg05 element');
    
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
    
    backgroundElement.innerHTML = '';
    
    if (type === 'image') {
      backgroundElement.style.backgroundImage = `url(${url})`;
      backgroundElement.style.backgroundSize = 'cover';
      backgroundElement.style.backgroundPosition = 'center';
      backgroundElement.style.backgroundRepeat = 'no-repeat';
      console.log('Image background set with cover');
    } else if (type === 'video' || type === 'youtube') {
      let videoElement;
      
      if (type === 'youtube') {
        videoElement = document.createElement('iframe');
        const videoId = extractYouTubeId(url);
        if (videoId) {
          // Simple and reliable autoplay parameters
          videoElement.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0`;
          videoElement.allow = 'autoplay; encrypted-media';
          videoElement.setAttribute('frameborder', '0');
          videoElement.setAttribute('title', 'Background Video');
          
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
        videoElement.muted = true;
        console.log('Video element created');
      }
      
      if (videoElement) {
        backgroundElement.appendChild(videoElement);
        console.log('Video/iframe added to background element');
      }
    } else if (type === 'none') {
      backgroundElement.style.backgroundImage = 'none';
      console.log('Background cleared');
    }
    
    // Make sure background element is visible
    backgroundElement.style.display = 'block';
    backgroundElement.style.opacity = '1';
    
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
setInterval(() => {
  try {
    if (window.location.href.includes('playentry.org/community/entrystory/') && !isInitialized) {
      init();
    } else if (!window.location.href.includes('playentry.org/community/entrystory/') && isInitialized) {
      // Reset if we navigate away
      console.log('Navigating away from target page, stopping audio');
      isInitialized = false;
      
      // Stop background audio
      stopBackgroundAudio();
      
      // Stop progress updater
      stopProgressUpdater();
      
      if (backgroundElement) {
        backgroundElement.remove();
        backgroundElement = null;
      }
      if (musicControlElement) {
        musicControlElement.remove();
        musicControlElement = null;
      }
    }
  } catch (error) {
    console.error('Error in interval check:', error);
  }
}, 500);

// Also check when page is loaded/refreshed
window.addEventListener('beforeunload', () => {
  try {
    console.log('Page unloading, stopping background audio');
    stopBackgroundAudio();
  } catch (error) {
    // Silent fail during page unload is acceptable
    console.warn('Error during page unload:', error.message);
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
      if (window.location.href.includes('playentry.org/community/entrystory/') && isInitialized) {
        // Give a small delay to ensure UI is ready
        setTimeout(() => {
          try {
            // Check if extension context is still valid before accessing storage
            if (!chrome.storage || !chrome.storage.local) {
              console.warn('Extension context invalidated, cannot check music settings');
              return;
            }
            
            // Re-check settings to ensure they're current
            chrome.storage.local.get([STORAGE_KEYS.MUSIC_ENABLED], (result) => {
              if (result[STORAGE_KEYS.MUSIC_ENABLED] === false) {
                console.log('Music disabled on tab return, stopping audio');
                stopBackgroundAudio();
              }
            });
          } catch (error) {
            if (error.message && error.message.includes('Extension context invalidated')) {
              console.warn('Extension context invalidated during visibility change - this is normal during extension reload');
            } else {
              console.error('Error checking music settings on visibility change:', error);
            }
          }
        }, 500);
      }
    }
  } catch (error) {
    console.warn('Error during visibility change:', error.message);
  }
});

// Initialize when DOM is ready - with enhanced error handling
try {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      try {
        init();
      } catch (error) {
        console.error('Error during DOMContentLoaded init:', error);
      }
    });
  } else {
    init();
  }
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
    if (error.message && error.message.includes('Extension context invalidated')) {
      console.log('🔄 Extension reloading - audio stopped locally');
      // Update local state even if we can't send the message
      currentAudioState.isPlaying = false;
      currentAudioState.currentTime = 0;
      currentAudioState.duration = 0;
      updateMusicDisplay('배경음악 없음', false);
      return true; // Consider this successful since we've cleaned up
    } else if (error.message && error.message.includes('message port closed')) {
      console.log('🔄 Message port closed - handling locally');
      currentAudioState.isPlaying = false;
      currentAudioState.currentTime = 0;
      currentAudioState.duration = 0;
      updateMusicDisplay('배경음악 없음', false);
      return true;
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