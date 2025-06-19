// Background Service Worker for Entry Background Extension

let offscreenDocumentId = null;

// Create offscreen document for audio playback
async function createOffscreenDocument() {
  try {
    // Check if an offscreen document is already active.
    if (await chrome.offscreen.hasDocument()) {
      console.log('Offscreen document already exists.');
      return;
    }
    
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Background music playback for Entry community'
    });
    
    console.log('Offscreen document created for audio playback');
  } catch (error) {
    if (error.message.includes('Only a single offscreen document may be created')) {
      console.warn('Offscreen document creation failed, it likely already exists.');
    } else {
      console.error('Error creating offscreen document:', error);
    }
  }
}

// Send message to offscreen document
async function sendToOffscreen(message) {
  try {
    console.log('🔄 Background: sendToOffscreen called with:', message);
    
    if (!await chrome.offscreen.hasDocument()) {
      console.log('🔄 Background: No offscreen document, creating...');
      await createOffscreenDocument();
    } else {
      console.log('🔄 Background: Offscreen document exists');
    }

    // Use a different approach - post message directly to offscreen
    console.log('🔄 Background: Setting up response listener...');
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.warn('🔄 Background: Offscreen response timeout');
        chrome.runtime.onMessage.removeListener(responseListener);
        resolve({ success: false, error: 'Response timeout' });
      }, 5000); // 5 second timeout
      
      // Create a temporary message listener for response
      const responseListener = (response, sender, sendResponse) => {
        if (response && response.fromOffscreen) {
          console.log('🔄 Background: Received response from offscreen:', response);
          clearTimeout(timeout);
          chrome.runtime.onMessage.removeListener(responseListener);
          resolve(response);
        }
      };
      
      chrome.runtime.onMessage.addListener(responseListener);
      
      // Send message to offscreen via broadcasting
      console.log('🔄 Background: Broadcasting message to offscreen...');
      chrome.runtime.sendMessage({
        ...message,
        toOffscreen: true
      }).catch((error) => {
        console.warn('🔄 Background: Message sending failed (expected for offscreen):', error);
        // Don't clear timeout here, let it resolve naturally
      });
    });
  } catch (error) {
    console.error('🔄 Background: Error sending to offscreen:', error);
    return { success: false, error: error.message };
  }
}

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('🏠 Background: Received message:', message);
  
  // Handle messages meant for offscreen document (these should be forwarded as-is)
  if (message.toOffscreen) {
    // Forward to offscreen - this will be handled by offscreen.js
    console.log('🏠 Background: Forwarding message to offscreen');
    return true;
  }
  
  // Handle messages from offscreen document with responses
  if (message.fromOffscreen) {
    console.log('🏠 Background: Received response from offscreen, ignoring in background handler');
    return false;
  }
  
  // Handle messages from content script and popup
  if (message.action === 'playAudio') {
    console.log('🏠 Background: Handling playAudio request');
    handleAudioPlayback(message).then(result => {
      console.log('🏠 Background: PlayAudio response:', result);
      sendResponse(result);
    }).catch(error => {
      console.error('🏠 Background: PlayAudio error:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep channel open for async response
  } else if (message.action === 'stopAudio') {
    console.log('Handling stopAudio request');
    handleAudioStop().then(result => {
      console.log('StopAudio response:', result);
      sendResponse(result);
    }).catch(error => {
      console.error('StopAudio error:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true;
  } else if (message.action === 'setVolume') {
    console.log('Handling setVolume request');
    handleVolumeChange(message.volume).then(result => {
      console.log('SetVolume response:', result);
      sendResponse(result);
    }).catch(error => {
      console.error('SetVolume error:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true;
  } else if (message.action === 'requestTabCapture') {
    console.log('🎭 Background: Handling requestTabCapture request');
    handleTabCapture().then(result => {
      console.log('🎭 Background: TabCapture response:', result);
      sendResponse(result);
    }).catch(error => {
      console.error('🎭 Background: TabCapture error:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true;
  } else if (message.action === 'notifyContent') {
    // Forward message from offscreen to content script
    forwardToContentScript(message);
    sendResponse({ success: true });
    return false;
  } else {
    console.warn('Unknown action in background:', message.action);
    sendResponse({ success: false, error: 'Unknown action' });
    return false;
  }
});

// Forward message to content script
async function forwardToContentScript(message) {
  try {
    const tabs = await chrome.tabs.query({ url: 'https://playentry.org/*' });
    
    for (const tab of tabs) {
      try {
        await chrome.tabs.sendMessage(tab.id, {
          action: 'notifyContent',
          event: message.event,
          data: message.data
        });
      } catch (error) {
        // Tab might not have content script loaded, ignore
      }
    }
  } catch (error) {
    console.error('Error forwarding to content script:', error);
  }
}

// Handle audio playback
async function handleAudioPlayback(message) {
  try {
    console.log('🎵 Background: handleAudioPlayback called with:', message);
    
    await createOffscreenDocument();
    console.log('🎵 Background: Offscreen document ready');
    
    // Send audio data to offscreen document
    console.log('🎵 Background: Sending message to offscreen...');
    const response = await sendToOffscreen({
      action: 'startAudio',
      url: message.url,
      type: message.type,
      volume: message.volume || 0.5,
      loop: message.loop !== false
    });
    
    console.log('🎵 Background: Audio playback response:', response);
    
    if (response && response.success === true) {
      return { success: true };
    } else {
      return { success: false, error: response?.error || 'Audio playback failed' };
    }
  } catch (error) {
    console.error('🎵 Background: Error handling audio playback:', error);
    return { success: false, error: error.message };
  }
}

// Handle audio stop
async function handleAudioStop() {
  try {
    if (await chrome.offscreen.hasDocument()) {
      const response = await sendToOffscreen({
        action: 'stopAudio'
      });
      return { success: true };
    }
    return { success: false, error: 'No offscreen document' };
  } catch (error) {
    console.error('Error handling audio stop:', error);
    return { success: false, error: error.message };
  }
}

// Handle volume change
async function handleVolumeChange(volume) {
  try {
    if (await chrome.offscreen.hasDocument()) {
      const response = await sendToOffscreen({
        action: 'setVolume',
        volume: volume
      });
      return { success: true };
    }
    return { success: false, error: 'No offscreen document' };
  } catch (error) {
    console.error('Error handling volume change:', error);
    return { success: false, error: error.message };
  }
}

// Handle tab capture for YouTube audio
async function handleTabCapture() {
  try {
    console.log('🎭 Background: Attempting to get tab capture stream...');
    
    // STEP 1: Check and clear any existing captures first
    try {
      const capturedTabs = await chrome.tabCapture.getCapturedTabs();
      console.log('🎭 Background: Current captured tabs:', capturedTabs);
      
      if (capturedTabs && capturedTabs.length > 0) {
        console.log('🧹 Background: Found existing captures, clearing them...');
        // Note: Chrome automatically stops captures when they are no longer needed
        // We don't need to manually stop them as there's no stop API
      }
    } catch (error) {
      console.log('🎭 Background: Could not check existing captures:', error.message);
    }
    
    // STEP 2: Get the current active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 0) {
      throw new Error('No active tab found');
    }
    
    const activeTab = tabs[0];
    console.log('🎭 Background: Active tab ID:', activeTab.id, 'URL:', activeTab.url);
    
    // STEP 3: Check if tab is suitable for capture
    if (!activeTab.url || activeTab.url.startsWith('chrome://') || activeTab.url.startsWith('chrome-extension://')) {
      throw new Error('Cannot capture system pages or extension pages');
    }
    
    // STEP 4: Try to get media stream ID using tabCapture API with retry
    let streamId = null;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (!streamId && attempts < maxAttempts) {
      attempts++;
      try {
        console.log(`🎭 Background: Attempt ${attempts}/${maxAttempts} to get stream ID...`);
        
        streamId = await chrome.tabCapture.getMediaStreamId({
          targetTabId: activeTab.id
        });
        
        if (streamId) {
          console.log('🎭 Background: Successfully obtained stream ID:', streamId);
          break;
        } else {
          console.warn(`🎭 Background: Attempt ${attempts} returned empty stream ID`);
        }
        
      } catch (error) {
        console.warn(`🎭 Background: Attempt ${attempts} failed:`, error.message);
        
        if (attempts < maxAttempts) {
          console.log(`🎭 Background: Waiting 1 second before retry...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    if (!streamId) {
      throw new Error('Failed to get stream ID after all attempts');
    }
    
    console.log('🎭 Background: TabCapture successful!');
    
    return { 
      success: true, 
      streamId: streamId,
      tabId: activeTab.id,
      tabUrl: activeTab.url
    };
    
  } catch (error) {
    console.error('🎭 Background: Error handling tab capture:', error);
    return { 
      success: false, 
      error: error.message || 'Tab capture failed'
    };
  }
}

// Cleanup on extension unload
chrome.runtime.onSuspend.addListener(() => {
  chrome.offscreen.closeDocument();
}); 