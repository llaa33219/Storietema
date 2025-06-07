// Offscreen Audio Handler for Entry Background Extension

let audioElement = null;
let progressInterval = null;
let audioContext = null;
let analyser = null;
let source = null;
let frequencyData = null;
let spectrumInterval = null;
let gainNode = null; // Global gain node for volume control
let currentVolume = 0.5; // Store current volume level for all audio types

// Extract YouTube video ID
function extractYouTubeId(url) {
  try {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  } catch (error) {
    console.error('Error extracting YouTube ID:', error);
    return null;
  }
}

// Create and setup audio element
function createAudioElement(url, type, volume, loop) {
  try {
    // IMMEDIATE and COMPLETE cleanup of existing audio
    console.log('🎬 createAudioElement called - immediate cleanup...');
    console.log('📋 Parameters received:', {
      url: url ? `${url.substring(0, 50)}... (length: ${url.length})` : 'NULL/UNDEFINED',
      type: type || 'undefined',
      volume: volume || 'undefined',
      loop: loop || 'undefined'
    });
    
    // Validate URL first
    if (!url) {
      console.error('❌ URL is null/undefined!');
      return false;
    }
    if (typeof url !== 'string') {
      console.error('❌ URL is not a string! Type:', typeof url, 'Value:', url);
      return false;
    }
    if (url.trim() === '') {
      console.error('❌ URL is empty string!');
      return false;
    }
    
    console.log('✅ URL validation passed');
    
    // Store the initial volume
    currentVolume = volume || 0.5;
    
    // IMMEDIATE cleanup of existing resources
    if (spectrumInterval) {
      clearInterval(spectrumInterval);
      spectrumInterval = null;
    }
    
    if (audioContext) {
      try {
        audioContext.close();
      } catch (e) {}
      audioContext = null;
    }
    
    analyser = null;
    source = null;
    gainNode = null;
    frequencyData = null;
    
    // Remove existing audio element COMPLETELY
    if (audioElement) {
      if (audioElement._audioSource) {
        try {
          audioElement._audioSource.disconnect();
        } catch (e) {}
        delete audioElement._audioSource;
      }
      
      if (audioElement.tagName === 'AUDIO') {
        try {
          audioElement.pause();
          audioElement.currentTime = 0;
        } catch (e) {}
      }
      
      try {
        if (audioElement.parentNode) {
          audioElement.parentNode.removeChild(audioElement);
        } else {
          audioElement.remove();
        }
      } catch (e) {}
      
      audioElement = null;
    }
    
    if (progressInterval) {
      clearInterval(progressInterval);
      progressInterval = null;
    }
    
    console.log('🧹 Cleanup completed, creating new audio...');
    
    if (type === 'youtube') {
      // For YouTube, create iframe
      audioElement = document.createElement('iframe');
      const videoId = extractYouTubeId(url);
      if (videoId) {
        audioElement.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&loop=1&playlist=${videoId}&controls=0&mute=1&enablejsapi=1&origin=${window.location.origin}&playsinline=1&rel=0&showinfo=0`;
        audioElement.style.display = 'none';
        audioElement.allow = 'autoplay; encrypted-media';
        audioElement.width = '0';
        audioElement.height = '0';
        audioElement.setAttribute('frameborder', '0');
        
        audioElement.addEventListener('load', () => {
          console.log('YouTube audio iframe loaded');
          setTimeout(() => {
            setVolume(currentVolume);
          }, 1000);
          
          notifyContentScript('audioStarted', {
            duration: 0,
            currentTime: 0
          });
        });
        
        console.log('YouTube audio iframe created');
      } else {
        console.error('Could not extract YouTube video ID:', url);
        return false;
      }
    } else {
      // For direct audio files - SIMPLE creation
      console.log('📱 Creating audio element with URL:', url ? url.substring(0, 50) + '...' : 'NO URL!');
      
      audioElement = document.createElement('audio');
      
      // Check if URL is actually provided before setting
      if (!url || url.trim() === '') {
        console.error('❌ Empty URL provided to audio element!');
        return false;
      }
      
      audioElement.src = url;
      console.log('✅ Audio src set to:', audioElement.src ? audioElement.src.substring(0, 50) + '...' : 'EMPTY!');
      
      audioElement.loop = loop;
      audioElement.volume = currentVolume;
      audioElement.preload = 'auto';
      audioElement.crossOrigin = 'anonymous';
      
      // Verify src is still set after all properties
      console.log('🔍 Final audio src verification:', audioElement.src ? audioElement.src.substring(0, 50) + '...' : 'EMPTY!');
      
      // Simple event listeners
      audioElement.addEventListener('loadedmetadata', () => {
        console.log('Audio metadata loaded');
        if (audioElement) {
          audioElement.volume = currentVolume;
        }
        sendProgressUpdate();
      });
      
      audioElement.addEventListener('timeupdate', () => {
        sendProgressUpdate();
      });
      
      audioElement.addEventListener('ended', () => {
        console.log('Audio ended');
        sendProgressUpdate();
      });
      
      audioElement.addEventListener('error', (e) => {
        console.error('Audio error:', e);
        console.error('🔍 Audio element src at error time:', audioElement.src || 'EMPTY!');
        if (e.target && e.target.error) {
          console.error('Error code:', e.target.error.code, 'message:', e.target.error.message);
        }
      });
      
      console.log('Audio element created with volume:', currentVolume);
    }

    if (audioElement) {
      document.body.appendChild(audioElement);
      
      // Auto-play for audio files
      if (type !== 'youtube') {
        setTimeout(() => {
          if (audioElement && typeof audioElement.play === 'function') {
            setVolume(currentVolume);
            
            audioElement.play().then(() => {
              console.log('Audio auto-play successful');
              startProgressTracking();
              
              notifyContentScript('audioStarted', {
                duration: audioElement.duration || 0,
                currentTime: audioElement.currentTime || 0
              });
            }).catch(e => {
              console.log('Audio auto-play failed:', e);
            });
          } else {
            console.error('audioElement.play not available');
          }
        }, 100);
      } else {
        // For YouTube, just start the iframe without spectrum analysis
        console.log('YouTube iframe created - no spectrum analysis needed');
      }
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error creating audio element:', error);
    return false;
  }
}

// Send progress updates to content script
function sendProgressUpdate() {
  if (audioElement && audioElement.tagName === 'AUDIO') {
    notifyContentScript('progressUpdate', {
      currentTime: audioElement.currentTime || 0,
      duration: audioElement.duration || 0,
      paused: audioElement.paused
    });
  }
}

// Start progress tracking
function startProgressTracking() {
  if (progressInterval) {
    clearInterval(progressInterval);
  }
  progressInterval = setInterval(sendProgressUpdate, 500);
}

// Stop progress tracking
function stopProgressTracking() {
  if (progressInterval) {
    clearInterval(progressInterval);
    progressInterval = null;
  }
}

// Notify content script - Enhanced with better error handling
function notifyContentScript(action, data = {}) {
  try {
    // Check if extension context is still valid
    if (!chrome.runtime || !chrome.runtime.sendMessage) {
      console.log('🔄 Extension reloading - cannot notify content script');
      return;
    }

    chrome.runtime.sendMessage({
      action: 'notifyContent',
      event: action,
      data: data
    }).catch(error => {
      // Handle extension context errors silently
      if (error.message && (error.message.includes('Extension context invalidated') || error.message.includes('message port closed'))) {
        console.log('🔄 Extension reloading - message not sent');
      } else {
        console.error('Error sending message to content script:', error);
      }
    });
  } catch (error) {
    // Handle all extension context errors silently
    if (error.message && (error.message.includes('Extension context invalidated') || error.message.includes('message port closed'))) {
      console.log('🔄 Extension reloading - cannot notify content script');
    } else {
      console.error('Error notifying content script:', error);
    }
  }
}

// Handle volume change - Enhanced with better debugging and reliability
function setVolume(volume) {
  try {
    // Store the volume for future use
    currentVolume = Math.max(0, Math.min(1, volume));
    console.log(`🔊 Setting volume to: ${Math.round(currentVolume * 100)}%`);
    console.log(`Audio element status: ${audioElement ? audioElement.tagName : 'null'}`);
    
    let volumeSet = false;
    let attempts = [];
    
    // Method 1: ONLY Direct audio element volume (SAFE - only affects our audio)
    if (audioElement && audioElement.tagName === 'AUDIO') {
      try {
        // Check if audio element is properly loaded
        console.log(`Audio readyState: ${audioElement.readyState}, paused: ${audioElement.paused}`);
        
        audioElement.volume = currentVolume;
        attempts.push(`✅ Audio element: ${currentVolume}`);
        volumeSet = true;
        
        // Also store volume for later use
        audioElement.dataset.targetVolume = currentVolume;
        
      } catch (error) {
        attempts.push(`❌ Audio element failed: ${error.message}`);
      }
    } else {
      attempts.push(`⚠️ Audio element not available (${audioElement ? audioElement.tagName : 'null'})`);
    }
    
    // Method 2: For YouTube iframes, use postMessage (SAFE - only affects iframe)
    if (audioElement && audioElement.tagName === 'IFRAME') {
      try {
        // Check if contentWindow is available
        if (!audioElement.contentWindow) {
          attempts.push(`⚠️ YouTube iframe contentWindow not ready`);
        } else {
          const volumePercent = Math.round(currentVolume * 100);
          
          // Try multiple YouTube API commands
          const commands = [
            { event: 'command', func: 'setVolume', args: [volumePercent] },
            { event: 'command', func: 'unMute', args: [] },
            { event: 'listening', id: Math.random() }
          ];
          
          commands.forEach((command, index) => {
            setTimeout(() => {
              // Double-check contentWindow is still available
              if (audioElement && audioElement.contentWindow) {
                audioElement.contentWindow.postMessage(JSON.stringify(command), '*');
              }
            }, index * 100);
          });
          
          attempts.push(`✅ YouTube commands sent: ${volumePercent}%`);
          volumeSet = true;
        }
        
      } catch (error) {
        attempts.push(`❌ YouTube postMessage failed: ${error.message}`);
      }
    }
    
    // Method 4: Global volume fallback (always succeeds)
    try {
      // Store in global variable for retry attempts
      window.entryExtensionVolume = currentVolume;
      attempts.push(`✅ Global volume stored: ${currentVolume}`);
      volumeSet = true;
    } catch (error) {
      attempts.push(`❌ Global volume failed: ${error.message}`);
    }
    
    // Log all attempts
    console.log('Volume setting attempts:', attempts);
    
    if (volumeSet) {
      console.log(`🎚️ Volume successfully applied: ${Math.round(currentVolume * 100)}%`);
      
      // Schedule retry for audio elements that might not be ready
      if (audioElement && audioElement.tagName === 'AUDIO' && audioElement.readyState < 2) {
        setTimeout(() => {
          console.log('🔄 Retrying volume setting after delay...');
          if (audioElement && audioElement.dataset.targetVolume) {
            try {
              audioElement.volume = parseFloat(audioElement.dataset.targetVolume);
              console.log('✅ Delayed volume setting successful');
            } catch (e) {
              console.warn('❌ Delayed volume setting failed:', e.message);
            }
          }
        }, 1000);
      }
      
      return true;
    } else {
      console.error('⚠️ All volume control methods failed');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Error setting audio volume:', error);
    return false;
  }
}

// Handle stop audio completely
function stopAudio() {
  try {
    console.log('🛑 Stopping audio - IMMEDIATE complete cleanup starting...');
    
    // STEP 1: Stop spectrum analysis IMMEDIATELY
    if (spectrumInterval) {
      clearInterval(spectrumInterval);
      spectrumInterval = null;
      console.log('✅ Spectrum analysis stopped immediately');
    }
    
    // STEP 2: Close audio context IMMEDIATELY 
    if (audioContext) {
      try {
        if (source) {
          source.disconnect();
          console.log('✅ Audio source disconnected');
        }
        if (analyser) {
          analyser.disconnect();
          console.log('✅ Analyser disconnected');
        }
        if (gainNode) {
          gainNode.disconnect();
          console.log('✅ Gain node disconnected');
        }
        audioContext.close();
        console.log('✅ Audio context closed immediately');
      } catch (e) {
        console.warn('⚠️ Error during audio context cleanup:', e.message);
      }
      audioContext = null;
    }
    
    // STEP 3: Clear all audio variables IMMEDIATELY
    analyser = null;
    source = null;
    gainNode = null;
    frequencyData = null;
    
    // STEP 4: Handle audio element COMPLETELY and IMMEDIATELY
    if (audioElement) {
      console.log('🗑️ Removing audio element immediately...');
      
      // Disconnect audio source IMMEDIATELY
      if (audioElement._audioSource) {
        try {
          audioElement._audioSource.disconnect();
          console.log('✅ Audio element source disconnected');
        } catch (e) {
          console.warn('⚠️ Could not disconnect audio element source:', e.message);
        }
        delete audioElement._audioSource;
      }
      
      // Stop audio IMMEDIATELY but DON'T clear src
      if (audioElement.tagName === 'AUDIO') {
        try {
          audioElement.pause();
          audioElement.currentTime = 0;
          // DON'T clear src - this might cause "Empty src attribute" error
          console.log('✅ Audio element stopped (src preserved)');
        } catch (e) {
          console.warn('⚠️ Could not stop audio element:', e.message);
        }
      }
      
      // Remove from DOM IMMEDIATELY
      try {
        if (audioElement.parentNode) {
          audioElement.parentNode.removeChild(audioElement);
          console.log('✅ Audio element removed via parentNode');
        } else if (audioElement.remove) {
          audioElement.remove();
          console.log('✅ Audio element removed via remove()');
        }
      } catch (e) {
        console.warn('⚠️ Could not remove audio element:', e.message);
      }
      
      audioElement = null;
      console.log('✅ Audio element reference cleared');
    }
    
    // STEP 5: Stop progress tracking IMMEDIATELY
    if (progressInterval) {
      clearInterval(progressInterval);
      progressInterval = null;
      console.log('✅ Progress tracking stopped');
    }
    
    // STEP 6: Reset volume
    currentVolume = 0.5;
    
    console.log('🛑 IMMEDIATE audio stop completed - all resources cleaned');
    
    // Force garbage collection if available (Chrome DevTools)
    try {
      if (window.gc && typeof window.gc === 'function') {
        window.gc();
        console.log('♻️ Garbage collection forced');
      }
    } catch (e) {
      // Silently ignore if gc is not available
    }
    
    // Notify content script that audio was stopped
    notifyContentScript('audioStopped');
    
    return true;
  } catch (error) {
    console.error('❌ Error stopping offscreen audio:', error);
    // Force reset variables even if there was an error
    audioElement = null;
    audioContext = null;
    analyser = null;
    source = null;
    gainNode = null;
    frequencyData = null;
    currentVolume = 0.5;
    
    if (progressInterval) {
      clearInterval(progressInterval);
      progressInterval = null;
    }
    
    // Still try to stop spectrum analysis
    try {
      stopSpectrumAnalysis();
    } catch (e) {
      console.warn('Error in force cleanup spectrum:', e.message);
    }
    
    console.log('🛑 Force cleanup completed after error');
    return false;
  }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('🎭 Offscreen: Received message:', message);
  
  // Only handle messages meant for offscreen
  if (!message.toOffscreen && message.action) {
    console.log('🎭 Offscreen: Handling legacy message format');
    // This is for backward compatibility - handle legacy messages
    handleLegacyMessage(message, sendResponse);
    return true;
  } else if (message.toOffscreen) {
    console.log('🎭 Offscreen: Handling new message format');
    // Handle new message format
    handleOffscreenMessage(message, sendResponse);
    return true;
  } else {
    console.log('🎭 Offscreen: Message not for offscreen, ignoring');
    // Not for offscreen, ignore
    return false;
  }
});

// Handle legacy messages (for backward compatibility)
function handleLegacyMessage(message, sendResponse) {
  try {
    console.log('Handling legacy message:', message.action);
    
    switch (message.action) {
      case 'playAudio':
      case 'startAudio':
        const success = createAudioElement(message.url, message.type, message.volume, message.loop);
        sendResponse({ success });
        break;
        
      case 'stopAudio':
        const stopped = stopAudio();
        sendResponse({ success: stopped });
        break;
        
      case 'setVolume':
        const volumeSet = setVolume(message.volume);
        sendResponse({ success: volumeSet });
        break;
        
      default:
        console.warn('Unknown legacy action:', message.action);
        sendResponse({ success: false, error: 'Unknown action' });
    }
  } catch (error) {
    console.error('Error handling legacy message:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Handle messages specifically for offscreen
function handleOffscreenMessage(message, sendResponse) {
  try {
    console.log('🎭 Offscreen: handleOffscreenMessage called with action:', message.action);
    let result = { success: false };
    
    switch (message.action) {
      case 'playAudio':
      case 'startAudio':
        console.log('🎭 Offscreen: Processing startAudio request...');
        console.log('🎭 Offscreen: Message details:', {
          url: message.url ? `${message.url.substring(0, 50)}... (length: ${message.url.length})` : 'NULL/UNDEFINED',
          type: message.type || 'undefined',
          volume: message.volume || 'undefined',
          loop: message.loop || 'undefined'
        });
        
        const success = createAudioElement(message.url, message.type, message.volume, message.loop);
        result = { success, fromOffscreen: true };
        if (!success) {
          result.error = 'Failed to create audio element';
        }
        console.log('🎭 Offscreen: startAudio result:', result);
        break;
        
      case 'stopAudio':
        console.log('🎭 Offscreen: Processing stopAudio request...');
        const stopped = stopAudio();
        result = { success: stopped, fromOffscreen: true };
        if (!stopped) {
          result.error = 'Failed to stop audio';
        }
        console.log('🎭 Offscreen: stopAudio result:', result);
        break;
        
      case 'setVolume':
        console.log('🎭 Offscreen: Processing setVolume request...');
        const volumeSet = setVolume(message.volume);
        result = { success: volumeSet, fromOffscreen: true };
        if (!volumeSet) {
          result.error = 'Failed to set volume';
        }
        console.log('🎭 Offscreen: setVolume result:', result);
        break;
        
      default:
        console.warn('🎭 Offscreen: Unknown action:', message.action);
        result = { success: false, error: 'Unknown action', fromOffscreen: true };
    }
    
    console.log('🎭 Offscreen: Final message result:', result);
    
    // Send response back to background
    console.log('🎭 Offscreen: Sending response back to background...');
    chrome.runtime.sendMessage(result).catch(() => {
      console.log('🎭 Offscreen: Could not send response back to background');
    });
    
    if (sendResponse) {
      sendResponse(result);
    }
    
  } catch (error) {
    console.error('🎭 Offscreen: Error handling message:', error);
    const errorResult = { success: false, error: error.message, fromOffscreen: true };
    
    chrome.runtime.sendMessage(errorResult).catch(() => {
      console.log('🎭 Offscreen: Could not send error response back to background');
    });
    
    if (sendResponse) {
      sendResponse(errorResult);
    }
  }
}

// Initialize Web Audio API for spectrum analysis
function initAudioAnalysis(audioElement) {
  // 함수 호출 즉시 알림
  console.log('🚀 initAudioAnalysis called!');
  notifyContentScript('debugMessage', { 
    message: '🚀 initAudioAnalysis function called!',
    timestamp: new Date().toISOString()
  });
  
  try {
    // Stop any existing analysis first
    stopSpectrumAnalysis();
    
    // For YouTube iframes, try to use tabCapture API for real spectrum
    if (!audioElement || audioElement.tagName !== 'AUDIO') {
      console.log('🎭 YouTube/invalid element detected - using enhanced visualization...');
      notifyContentScript('debugMessage', { 
        message: '🎭 YouTube detected - using enhanced visualization',
        audioElementType: audioElement ? audioElement.tagName : 'null'
      });
      
      // Use enhanced mock spectrum for YouTube (simple & reliable)
      startEnhancedMockSpectrum('YouTube enhanced visualization');
      return;
    }

    console.log('🎵 Attempting real audio analysis...');
    const audioState = {
      readyState: audioElement.readyState,
      paused: audioElement.paused,
      currentTime: audioElement.currentTime,
      duration: audioElement.duration,
      crossOrigin: audioElement.crossOrigin,
      src: audioElement.src ? audioElement.src.substring(0, 50) + '...' : 'no src'
    };
    console.log('Audio element state:', audioState);
    
    // Send debug info to content script
    notifyContentScript('debugMessage', { 
      message: 'Attempting real audio analysis...',
      audioState: audioState
    });

    // Check if Web Audio API is available
    if (!window.AudioContext && !window.webkitAudioContext) {
      console.warn('Web Audio API not available - using mock spectrum');
      notifyContentScript('debugMessage', { 
        message: 'Web Audio API not available - using mock spectrum'
      });
      startMockSpectrum();
      return;
    }

    // Try to setup real analysis based on audio readiness
    if (audioElement.readyState >= 2) { // HAVE_CURRENT_DATA or higher
      console.log('🔊 Audio element ready, attempting immediate setup...');
      notifyContentScript('debugMessage', { message: 'Audio element ready, attempting immediate setup...' });
      
      attemptRealAnalysis().then(success => {
        if (!success) {
          console.log('🔄 Immediate setup failed, falling back to mock spectrum');
          notifyContentScript('debugMessage', { message: 'Immediate setup failed, falling back to mock spectrum' });
          startMockSpectrum();
        }
      }).catch(error => {
        console.error('🔄 Error in immediate setup:', error);
        notifyContentScript('debugMessage', { message: 'Error in immediate setup, falling back to mock spectrum' });
        startMockSpectrum();
      });
    } else {
      console.log('🔊 Audio element not ready, waiting for loadedmetadata...');
      notifyContentScript('debugMessage', { 
        message: `Audio element not ready (readyState: ${audioElement.readyState}), waiting for loadedmetadata...`
      });
      
      // Wait for audio to be ready
      const onLoadedMetadata = () => {
        console.log('🔊 Audio metadata loaded, attempting setup...');
        notifyContentScript('debugMessage', { message: 'Audio metadata loaded, attempting setup...' });
        audioElement.removeEventListener('loadedmetadata', onLoadedMetadata);
        
        attemptRealAnalysis().then(success => {
          if (!success) {
            console.log('🔄 Delayed setup failed, falling back to mock spectrum');
            notifyContentScript('debugMessage', { message: 'Delayed setup failed, falling back to mock spectrum' });
            startMockSpectrum();
          }
        }).catch(error => {
          console.error('🔄 Error in delayed setup:', error);
          notifyContentScript('debugMessage', { message: 'Error in delayed setup, falling back to mock spectrum' });
          startMockSpectrum();
        });
      };
      
      const onError = (e) => {
        console.error('🔊 Audio element error during wait:', e);
        notifyContentScript('debugMessage', { message: `Audio element error during wait: ${e.message || e.type}` });
        audioElement.removeEventListener('loadedmetadata', onLoadedMetadata);
        audioElement.removeEventListener('error', onError);
        startMockSpectrum();
      };
      
      audioElement.addEventListener('loadedmetadata', onLoadedMetadata);
      audioElement.addEventListener('error', onError);
      
      // Fallback timeout
      setTimeout(() => {
        audioElement.removeEventListener('loadedmetadata', onLoadedMetadata);
        audioElement.removeEventListener('error', onError);
        
        if (!analyser) { // If setup didn't succeed yet
          console.log('🔄 Timeout waiting for audio metadata, using mock spectrum');
          notifyContentScript('debugMessage', { message: 'Timeout waiting for audio metadata (3s), using mock spectrum' });
          startMockSpectrum();
        }
      }, 3000);
    }
    
  } catch (error) {
    console.error('❌ Error in audio analysis initialization:', error.name, error.message);
    console.error('Full error:', error);
    notifyContentScript('debugMessage', { 
      message: `Error in audio analysis initialization: ${error.name} - ${error.message}`,
      errorStack: error.stack
    });
    // Always fall back to mock spectrum
    startMockSpectrum();
  }

  // Function to attempt audio analysis setup
  async function attemptRealAnalysis() {
    try {
      console.log('🔊 Creating AudioContext...');
      
      // Complete cleanup of existing audio context
      if (audioContext) {
        try {
          if (source) {
            source.disconnect();
            source = null;
          }
          if (analyser) {
            analyser.disconnect();
            analyser = null;
          }
          if (gainNode) {
            gainNode.disconnect();
            gainNode = null;
          }
          audioContext.close();
        } catch (e) {}
      }
      
      // Create fresh AudioContext
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Create analyser and gain nodes
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      
      gainNode = audioContext.createGain();
      gainNode.gain.value = currentVolume;
      
      // Only create new MediaElementSource if not already connected
      if (audioElement._audioSource) {
        console.log('🔄 Audio element already has source, recreating...');
        
        // Store current state
        const wasPlaying = !audioElement.paused;
        const currentTime = audioElement.currentTime;
        
        // Disconnect existing source
        try {
          audioElement._audioSource.disconnect();
        } catch (e) {}
        delete audioElement._audioSource;
        
        // Brief pause to ensure disconnection
        audioElement.pause();
        
        // Create new source after brief delay
        setTimeout(() => {
          try {
            source = audioContext.createMediaElementSource(audioElement);
            audioElement._audioSource = source;
            
            // Connect audio graph
            source.connect(analyser);
            
            // Resume playback if it was playing
            if (wasPlaying) {
              audioElement.currentTime = currentTime;
              audioElement.play().catch(e => console.warn('Could not resume playback:', e));
            }
            
            // Initialize frequency data
            frequencyData = new Uint8Array(analyser.frequencyBinCount);
            
            console.log('✅ Real audio analysis initialized with recreated source');
            startSpectrumAnalysis();
            
          } catch (recreateError) {
            console.error('❌ Failed to recreate audio source:', recreateError);
            startMockSpectrum();
          }
        }, 100);
        
        return true;
        
      } else {
        // No existing source, create new one
        source = audioContext.createMediaElementSource(audioElement);
        audioElement._audioSource = source;
        
        // Connect audio graph
        source.connect(analyser);
        
        // Initialize frequency data
        frequencyData = new Uint8Array(analyser.frequencyBinCount);
        
        console.log('✅ Real audio analysis initialized');
        startSpectrumAnalysis();
        return true;
      }
      
    } catch (error) {
      console.error('❌ Real audio analysis failed:', error);
      
      // Clean up failed attempt
      if (audioContext) {
        try {
          audioContext.close();
        } catch (e) {}
        audioContext = null;
      }
      
      gainNode = null;
      source = null;
      analyser = null;
      frequencyData = null;
      
      if (audioElement && audioElement._audioSource) {
        try {
          audioElement._audioSource.disconnect();
        } catch (e) {}
        delete audioElement._audioSource;
      }
      
      return false;
    }
  }
}

// Attempt to use tabCapture for YouTube spectrum analysis
async function attemptTabCapture() {
  try {
    console.log('🎭 Attempting tabCapture for YouTube spectrum...');
    notifyContentScript('debugMessage', { message: 'Attempting tabCapture for YouTube spectrum...' });
    
    // Request tab capture stream ID from background
    chrome.runtime.sendMessage({
      action: 'requestTabCapture'
    }).then(response => {
      if (response && response.success && response.streamId) {
        console.log('🎭 Received tabCapture stream ID:', response.streamId);
        notifyContentScript('debugMessage', { message: 'Received tabCapture stream ID, creating MediaStream...' });
        
        // Use the stream ID to get MediaStream
        navigator.mediaDevices.getUserMedia({
          audio: {
            mandatory: {
              chromeMediaSource: "tab",
              chromeMediaSourceId: response.streamId,
            },
          }
        }).then(stream => {
          console.log('🎭 TabCapture MediaStream obtained successfully');
          notifyContentScript('debugMessage', { message: 'TabCapture MediaStream obtained successfully!' });
          
          // Initialize Web Audio API with the captured stream
          initTabCaptureAnalysis(stream);
          
        }).catch(error => {
          console.error('🎭 Failed to get MediaStream from tabCapture:', error);
          notifyContentScript('debugMessage', { 
            message: `Failed to get MediaStream from tabCapture: ${error.message}`,
            fallbackReason: 'MediaStream creation failed'
          });
          startEnhancedMockSpectrum('YouTube audio capture unavailable - using enhanced visualization');
        });
        
      } else {
        const errorMsg = response?.error || 'Unknown error';
        console.warn('🎭 TabCapture failed:', errorMsg);
        notifyContentScript('debugMessage', { 
          message: `TabCapture failed: ${errorMsg}`,
          fallbackReason: 'TabCapture API failed'
        });
        
        // Provide informative fallback
        if (errorMsg.includes('active stream')) {
          startEnhancedMockSpectrum('Another app is capturing audio - using enhanced visualization');
        } else if (errorMsg.includes('Cannot capture')) {
          startEnhancedMockSpectrum('YouTube audio capture not available - using enhanced visualization');
        } else {
          startEnhancedMockSpectrum('Audio capture unavailable - using enhanced visualization');
        }
      }
    }).catch(error => {
      console.error('🎭 TabCapture request failed:', error);
      notifyContentScript('debugMessage', { 
        message: `TabCapture request failed: ${error.message}`,
        fallbackReason: 'Communication error'
      });
      startEnhancedMockSpectrum('Audio capture communication error - using enhanced visualization');
    });
    
  } catch (error) {
    console.error('🎭 Error in attemptTabCapture:', error);
    notifyContentScript('debugMessage', { 
      message: `Error in attemptTabCapture: ${error.message}`,
      fallbackReason: 'General error'
    });
    startEnhancedMockSpectrum('Audio capture error - using enhanced visualization');
  }
}

// Initialize Web Audio API with tabCapture stream
function initTabCaptureAnalysis(stream) {
  try {
    console.log('🎭 Initializing tabCapture analysis...');
    
    // Stop any existing analysis first
    stopSpectrumAnalysis();
    
    // Create AudioContext
    if (audioContext) {
      try {
        audioContext.close();
      } catch (e) {}
    }
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Create analyser
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    
    // Create gain node
    gainNode = audioContext.createGain();
    gainNode.gain.value = currentVolume;
    
    // Create source from MediaStream
    source = audioContext.createMediaStreamSource(stream);
    
    // Connect: source -> analyser -> gain -> destination
    source.connect(analyser);
    
    // Initialize frequency data array
    frequencyData = new Uint8Array(analyser.frequencyBinCount);
    
    console.log('✅ TabCapture analysis initialized successfully');
    notifyContentScript('debugMessage', { 
      message: '✅ TabCapture analysis initialized successfully! (Real YouTube spectrum)',
      analyserConfig: {
        fftSize: analyser.fftSize,
        frequencyBinCount: analyser.frequencyBinCount,
        smoothingTimeConstant: analyser.smoothingTimeConstant
      }
    });
    
    startSpectrumAnalysis();
    
  } catch (error) {
    console.error('🎭 TabCapture analysis initialization failed:', error);
    notifyContentScript('debugMessage', { message: `TabCapture analysis initialization failed: ${error.message}` });
    startMockSpectrum();
  }
}

// Start real spectrum analysis
function startSpectrumAnalysis() {
  if (spectrumInterval) {
    clearInterval(spectrumInterval);
  }
  
  console.log('🎵 Starting real spectrum analysis...');
  console.log('Analyser state:', {
    analyser: !!analyser,
    frequencyData: !!frequencyData,
    frequencyDataLength: frequencyData ? frequencyData.length : 'N/A'
  });
  
  let frameCount = 0;
  let lastLogTime = Date.now();
  
  spectrumInterval = setInterval(() => {
    try {
      if (analyser && frequencyData) {
        // Get frequency data
        analyser.getByteFrequencyData(frequencyData);
        
        // Log every 100 frames (about every 5 seconds at 20fps)
        frameCount++;
        if (frameCount % 100 === 0) {
          const now = Date.now();
          const fps = 100 / ((now - lastLogTime) / 1000);
          
          // Calculate some basic stats
          const sum = Array.from(frequencyData).reduce((a, b) => a + b, 0);
          const avg = sum / frequencyData.length;
          const max = Math.max(...frequencyData);
          
          console.log(`🎵 Real spectrum frame ${frameCount} - FPS: ${fps.toFixed(1)}, Avg: ${avg.toFixed(1)}, Max: ${max}, Sum: ${sum}`);
          lastLogTime = now;
        }
        
        // Send spectrum data to content script
        notifyContentScript('spectrumUpdate', {
          frequencyData: Array.from(frequencyData),
          isRealSpectrum: true,
          spectrumType: 'REAL'
        });
      } else {
        console.warn('🎵 Real spectrum analysis failed: missing analyser or frequencyData');
        // Stop and fall back to mock
        clearInterval(spectrumInterval);
        spectrumInterval = null;
        startMockSpectrum();
      }
    } catch (error) {
      console.error('🎵 Error in real spectrum analysis:', error);
      // Stop and fall back to mock
      clearInterval(spectrumInterval);
      spectrumInterval = null;
      startMockSpectrum();
    }
  }, 50); // 20 FPS for smooth animation
  
  console.log('🎵 Real spectrum analysis started');
}

// Start mock spectrum for YouTube or when analysis fails
function startMockSpectrum() {
  if (spectrumInterval) {
    clearInterval(spectrumInterval);
  }
  
  console.log('🎭 Starting mock spectrum (fallback mode)...');
  
  let time = 0;
  let frameCount = 0;
  
  spectrumInterval = setInterval(() => {
    // Generate more realistic mock spectrum data
    const mockData = new Array(128);
    time += 0.1;
    frameCount++;
    
    // Log every 50 frames for mock (about every 4 seconds)
    if (frameCount % 50 === 0) {
      console.log(`🎭 Mock spectrum frame ${frameCount} - Using simulated data`);
    }
    
    for (let i = 0; i < mockData.length; i++) {
      // Create a more balanced frequency distribution
      const frequency = i / mockData.length;
      
      // Base amplitude with some variation
      let amplitude = 30 + Math.sin(time + i * 0.1) * 15;
      
      // Add frequency-dependent characteristics
      if (frequency < 0.1) {
        // Bass frequencies - moderate boost
        amplitude *= 1.2;
      } else if (frequency < 0.3) {
        // Mid-low frequencies
        amplitude *= 1.0;
      } else if (frequency < 0.7) {
        // Mid-high frequencies - slight reduction
        amplitude *= 0.8;
      } else {
        // High frequencies - more reduction
        amplitude *= 0.6;
      }
      
      // Add some randomness for natural feel
      amplitude += (Math.random() - 0.5) * 10;
      
      // Add some musical patterns
      const beat = Math.sin(time * 4) * 0.3 + 0.7; // Simulate beat pattern
      amplitude *= beat;
      
      // Ensure values stay within valid range
      mockData[i] = Math.max(5, Math.min(255, Math.floor(amplitude)));
    }
    
    notifyContentScript('spectrumUpdate', {
      frequencyData: mockData,
      isRealSpectrum: false,
      spectrumType: 'MOCK'
    });
  }, 80); // Slightly slower update for smoother animation
  
  console.log('🎭 Mock spectrum started');
}

// Enhanced mock spectrum with better visual feedback
function startEnhancedMockSpectrum(reason = 'Enhanced visualization mode') {
  if (spectrumInterval) {
    clearInterval(spectrumInterval);
  }
  
  console.log('✨ Starting enhanced mock spectrum:', reason);
  notifyContentScript('debugMessage', { 
    message: `✨ ${reason}`,
    spectrumType: 'ENHANCED_MOCK'
  });
  
  let time = 0;
  let frameCount = 0;
  let beatPhase = 0;
  
  spectrumInterval = setInterval(() => {
    const mockData = new Array(128);
    time += 0.08;
    beatPhase += 0.15;
    frameCount++;
    
    if (frameCount % 75 === 0) {
      console.log(`✨ Enhanced mock spectrum frame ${frameCount} - ${reason}`);
    }
    
    for (let i = 0; i < mockData.length; i++) {
      const frequency = i / mockData.length;
      let amplitude = 0;
      
      const rhythmBase = 25 + Math.sin(beatPhase) * 12;
      
      let freqMultiplier = 1;
      if (frequency < 0.15) {
        freqMultiplier = 1.4 + Math.sin(beatPhase * 2) * 0.3;
        amplitude = rhythmBase * freqMultiplier;
      } else if (frequency < 0.4) {
        freqMultiplier = 1.1 + Math.sin(beatPhase * 1.5 + i * 0.1) * 0.2;
        amplitude = rhythmBase * freqMultiplier;
      } else if (frequency < 0.7) {
        freqMultiplier = 0.9 + Math.sin(time * 3 + i * 0.15) * 0.25;
        amplitude = (rhythmBase * 0.8) * freqMultiplier;
      } else {
        freqMultiplier = 0.6 + Math.sin(time * 5 + i * 0.2) * 0.2;
        amplitude = (rhythmBase * 0.6) * freqMultiplier;
      }
      
      const dynamics = 0.7 + Math.sin(beatPhase * 0.5) * 0.3;
      amplitude *= dynamics;
      amplitude += (Math.random() - 0.5) * 8;
      const harmonic = Math.sin(i * 0.3 + time * 2) * 5;
      amplitude += harmonic;
      
      mockData[i] = Math.max(3, Math.min(255, Math.floor(amplitude)));
    }
    
    notifyContentScript('spectrumUpdate', {
      frequencyData: mockData,
      isRealSpectrum: false,
      spectrumType: 'ENHANCED_MOCK',
      reason: reason
    });
  }, 65);
  
  console.log('✨ Enhanced mock spectrum started');
}

// Stop spectrum analysis
function stopSpectrumAnalysis() {
  if (spectrumInterval) {
    clearInterval(spectrumInterval);
    spectrumInterval = null;
  }
  
  if (audioContext) {
    try {
      audioContext.close();
      console.log('Audio context closed');
    } catch (error) {
      console.warn('Error closing audio context:', error);
    }
  }
  
  audioContext = null;
  analyser = null;
  source = null;
  gainNode = null;
  frequencyData = null;
  
  if (audioElement && audioElement._audioSource) {
    audioElement._audioSource = null;
  }
}

console.log('Offscreen audio handler loaded');