// Entry Background Extension Popup Script - Multi-Theme Support

// Storage keys
const STORAGE_KEYS = {
  BACKGROUNDS: 'entry_backgrounds',
  MUSIC_ITEMS: 'entry_music_items',
  ACTIVE_BACKGROUND: 'entry_active_background',
  ACTIVE_MUSIC: 'entry_active_music',
  MUSIC_ENABLED: 'entry_music_enabled',
  MUSIC_VOLUME: 'entry_music_volume'
};

// DOM elements
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const musicEnabled = document.getElementById('music-enabled');
const volumeSlider = document.getElementById('music-volume');
const volumeValue = document.getElementById('volume-value');
const status = document.getElementById('status');

// Grid elements
const backgroundGrid = document.getElementById('background-grid');
const musicGrid = document.getElementById('music-grid');
const addBackgroundBtn = document.getElementById('add-background-btn');
const addMusicBtn = document.getElementById('add-music-btn');

// Modal elements
const backgroundModal = document.getElementById('background-modal');
const musicModal = document.getElementById('music-modal');
const deleteModal = document.getElementById('delete-modal');

// Delete modal elements
const deleteModalTitle = document.getElementById('delete-modal-title');
const deleteModalMessage = document.getElementById('delete-modal-message');
const closeDeleteModalBtn = document.getElementById('close-delete-modal');
const cancelDeleteBtn = document.getElementById('cancel-delete');
const confirmDeleteBtn = document.getElementById('confirm-delete');

// State
let backgrounds = [];
let musicItems = [];
let activeBackgroundId = null;
let activeMusicId = null;
let pendingDeleteId = null;
let pendingDeleteType = null;

// Cache for storing analyzed spectrum data
const spectrumCache = new Map();

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing popup...');
  
  // 초기 탭 상태 확인
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  
  console.log('Tab buttons found:', tabButtons.length);
  console.log('Tab contents found:', tabContents.length);
  
  setupEventListeners();
  loadData();
  
  // 초기 탭 설정 (배경 탭이 기본으로 활성화되도록)
  setTimeout(() => {
    ensureDefaultTab();
  }, 100);
});

// Ensure default tab is properly set
function ensureDefaultTab() {
  const backgroundTab = document.getElementById('background-tab');
  const musicTab = document.getElementById('music-tab');
  const backgroundBtn = document.querySelector('.tab-btn[data-tab="background"]');
  const musicBtn = document.querySelector('.tab-btn[data-tab="music"]');
  
  console.log('Ensuring default tab...');
  console.log('Background tab:', backgroundTab);
  console.log('Music tab:', musicTab);
  console.log('Background button:', backgroundBtn);
  console.log('Music button:', musicBtn);
  
  // 배경 탭 활성화
  if (backgroundTab && musicTab && backgroundBtn && musicBtn) {
    backgroundTab.style.display = 'block';
    musicTab.style.display = 'none';
    backgroundBtn.classList.add('active');
    musicBtn.classList.remove('active');
    
    console.log('Default tab set to background');
  } else {
    console.error('Tab elements not found properly');
  }
}

// Setup all event listeners
function setupEventListeners() {
  // Tab switching
  tabButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      const tabName = e.target.dataset.tab;
      switchTab(tabName);
    });
  });

  // Add buttons
  addBackgroundBtn.addEventListener('click', () => openModal('background'));
  addMusicBtn.addEventListener('click', () => openModal('music'));

  // Setup modal event listeners
  setupModalControls();
  
  // Setup delete modal event listeners
  setupDeleteModalControls();
  
  // Volume control
  volumeSlider.addEventListener('input', (e) => {
    volumeValue.textContent = e.target.value;
    saveSettings();
  });

  // Music enabled toggle
  musicEnabled.addEventListener('change', () => {
    saveSettings();
  });
}

// Setup modal event listeners
function setupModalControls() {
  // Background modal
  document.getElementById('close-background-modal').addEventListener('click', () => closeModal('background'));
  document.getElementById('cancel-background').addEventListener('click', () => closeModal('background'));
  document.getElementById('save-background').addEventListener('click', saveBackground);

  // Music modal
  document.getElementById('close-music-modal').addEventListener('click', () => closeModal('music'));
  document.getElementById('cancel-music').addEventListener('click', () => closeModal('music'));
  document.getElementById('save-music').addEventListener('click', saveMusic);

  // Modal option group toggles
  setupOptionGroups('background');
  setupOptionGroups('music');

  // File upload auto-save listeners
  setupFileUploadListeners();

  // Close modal when clicking outside
  backgroundModal.addEventListener('click', (e) => {
    if (e.target === backgroundModal) closeModal('background');
  });
  musicModal.addEventListener('click', (e) => {
    if (e.target === musicModal) closeModal('music');
  });
}

// Setup option group functionality
function setupOptionGroups(type) {
  const prefix = type === 'background' ? 'bg' : 'music';
  const radioButtons = document.querySelectorAll(`input[name="${type}-type"]`);
  
  radioButtons.forEach(radio => {
    radio.addEventListener('change', () => {
      updateOptionVisibility(type);
    });
  });
}

// Update option visibility in modals
function updateOptionVisibility(type) {
  const prefix = type === 'background' ? 'bg' : 'music';
  const container = type === 'background' ? '.background-options' : '.music-options';
  const optionGroups = document.querySelectorAll(`${container} .option-group`);
  
  optionGroups.forEach(group => {
    const radio = group.querySelector('input[type="radio"]');
    if (radio.checked) {
      group.classList.add('selected');
    } else {
      group.classList.remove('selected');
    }
  });
}

// Switch tabs
function switchTab(tabName) {
  console.log('Switching to tab:', tabName);
  
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  
  console.log('Available tab buttons:', Array.from(tabButtons).map(btn => btn.dataset.tab));
  console.log('Available tab contents:', Array.from(tabContents).map(content => content.id));
  
  tabButtons.forEach(btn => {
    const isActive = btn.dataset.tab === tabName;
    btn.classList.toggle('active', isActive);
    console.log(`Button ${btn.dataset.tab} active:`, isActive);
  });

  tabContents.forEach(content => {
    const shouldShow = content.id === `${tabName}-tab`;
    content.style.display = shouldShow ? 'block' : 'none';
    console.log(`Content ${content.id} display:`, shouldShow ? 'block' : 'none');
  });
  
  console.log('Tab switch completed');
}

// Open modal
function openModal(type) {
  const modal = type === 'background' ? backgroundModal : musicModal;
  
  // Reset form
  resetModalForm(type);
  
  // Show modal
  modal.style.display = 'block';
  
  // Update option visibility
  updateOptionVisibility(type);
}

// Close modal
function closeModal(type) {
  const modal = type === 'background' ? backgroundModal : musicModal;
  modal.style.display = 'none';
}

// Reset modal form
function resetModalForm(type) {
  if (type === 'background') {
    document.getElementById('background-name').value = '';
    document.getElementById('bg-none').checked = true;
    document.getElementById('bg-image-file-input').value = '';
    document.getElementById('bg-image-url-input').value = '';
    document.getElementById('bg-video-file-input').value = '';
    document.getElementById('bg-video-url-input').value = '';
    document.getElementById('bg-youtube-input').value = '';
    } else {
    document.getElementById('music-name').value = '';
    document.getElementById('music-file').checked = true;
    document.getElementById('music-file-input').value = '';
    document.getElementById('music-url-input').value = '';
    document.getElementById('music-youtube-input').value = '';
  }
}

// Save background
async function saveBackground() {
  const name = document.getElementById('background-name').value.trim();
  if (!name) {
    showStatus('배경 이름을 입력하세요', 'error');
    return;
  }

  const selectedType = document.querySelector('input[name="background-type"]:checked');
  if (!selectedType) {
    showStatus('배경 타입을 선택하세요', 'error');
    return;
  }

  showStatus('배경 저장 중...', 'info');

  const background = {
    id: Date.now(),
    name: name,
    type: selectedType.value === 'none' ? 'none' : selectedType.value.split('-')[0],
    url: ''
  };

  // Handle different background types
  try {
    const url = await getBackgroundUrl(selectedType.value);
    background.url = url;

    backgrounds.push(background);
    await saveData();
    renderBackgrounds();
    closeModal('background');
    showStatus('배경 저장 완료', 'success');
  } catch (error) {
    console.error('Error saving background:', error);
    showStatus('배경 저장 실패', 'error');
  }
}

// Get background URL based on type
async function getBackgroundUrl(typeValue) {
  switch (typeValue) {
    case 'none':
      return '';
          case 'image-file':
      const imageFile = document.getElementById('bg-image-file-input').files[0];
      return imageFile ? await fileToDataURL(imageFile) : '';
          case 'image-url':
      return document.getElementById('bg-image-url-input').value;
          case 'video-file':
      const videoFile = document.getElementById('bg-video-file-input').files[0];
      return videoFile ? await fileToDataURL(videoFile) : '';
          case 'video-url':
      return document.getElementById('bg-video-url-input').value;
          case 'youtube':
      return document.getElementById('bg-youtube-input').value;
    default:
      return '';
  }
}

// Save music
async function saveMusic() {
  const name = document.getElementById('music-name').value.trim();
  if (!name) {
    showStatus('음악 이름을 입력하세요', 'error');
    return;
  }

  const selectedType = document.querySelector('input[name="music-type"]:checked');
  if (!selectedType) {
    showStatus('음악 타입을 선택하세요', 'error');
    return;
  }

  showStatus('음악 저장 중...', 'info');

  const music = {
    id: Date.now(),
    name: name,
    type: selectedType.value,
    url: ''
  };

  // Handle different music types
  try {
    const url = await getMusicUrl(selectedType.value);
    music.url = url;

    musicItems.push(music);
    await saveData();
    renderMusic();
    closeModal('music');
    showStatus('음악 저장 완료', 'success');
  } catch (error) {
    console.error('Error saving music:', error);
    showStatus('음악 저장 실패', 'error');
  }
}

// Get music URL based on type
async function getMusicUrl(type) {
  switch (type) {
    case 'file':
      const musicFile = document.getElementById('music-file-input').files[0];
      return musicFile ? await fileToDataURL(musicFile) : '';
    case 'url':
      return document.getElementById('music-url-input').value;
    case 'youtube':
      return document.getElementById('music-youtube-input').value;
    default:
      return '';
  }
}

// Convert file to data URL
function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Render backgrounds
function renderBackgrounds() {
  backgroundGrid.innerHTML = '';
  
  backgrounds.forEach(bg => {
    const card = createThemeCard(bg, 'background');
    backgroundGrid.appendChild(card);
  });
}

// Render music
function renderMusic() {
  musicGrid.innerHTML = '';
  
  musicItems.forEach(music => {
    const card = createThemeCard(music, 'music');
    musicGrid.appendChild(card);
  });
}

// Create theme card
function createThemeCard(item, type) {
  const card = document.createElement('div');
  card.className = `theme-card ${item.id === (type === 'background' ? activeBackgroundId : activeMusicId) ? 'active' : ''}`;
  
  if (type === 'background') {
    // 배경 카드 - 미리보기 중심
    const preview = getBackgroundPreview(item);
    card.innerHTML = `
      <button class="delete-btn">&times;</button>
      <div class="theme-preview" style="${preview.style}">${preview.content}</div>
      <div class="theme-info">
        <h4>${item.name}</h4>
        <p>${getTypeText(item.type)}</p>
      </div>
    `;
  } else {
    // 음악 카드 - 기존 방식
    const preview = getPreviewContent(item, type);
    const typeText = getTypeText(item.type);
    card.innerHTML = `
      <button class="delete-btn">&times;</button>
      <h4>${item.name}</h4>
      <p>${typeText}</p>
      <div class="preview">${preview}</div>
    `;
  }
  
  // Add delete button event listener
  const deleteBtn = card.querySelector('.delete-btn');
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent card selection
    e.preventDefault();
    deleteItem(item.id, type);
  });
  
  // Add card selection event listener
  card.addEventListener('click', (e) => {
    if (!e.target.classList.contains('delete-btn')) {
      selectItem(item.id, type);
    }
  });
  
  return card;
}

// Get background preview
function getBackgroundPreview(item) {
  switch (item.type) {
    case 'none':
      return {
        style: 'background: linear-gradient(45deg, #f0f0f0 25%, transparent 25%), linear-gradient(-45deg, #f0f0f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f0f0f0 75%), linear-gradient(-45deg, transparent 75%, #f0f0f0 75%); background-size: 20px 20px; background-position: 0 0, 0 10px, 10px -10px, -10px 0px;',
        content: '<div style="display: flex; align-items: center; justify-content: center; height: 100%; font-size: 20px; color: #999;">미리보기 없음</div>'
      };
    case 'image':
      if (item.url.startsWith('data:')) {
        return {
          style: `background-image: url(${item.url}); background-size: cover; background-position: center;`,
          content: ''
        };
      } else {
        return {
          style: `background-image: url(${item.url}); background-size: cover; background-position: center;`,
          content: ''
        };
      }
    case 'video':
      return {
        style: 'background: #000000;',
        content: '<div style="display: flex; align-items: center; justify-content: center; height: 100%; font-size: 24px; color: white;">미리보기 없음</div>'
      };
    case 'youtube':
      const videoId = extractYouTubeId(item.url);
      if (videoId) {
        return {
          style: `background-image: url(https://img.youtube.com/vi/${videoId}/mqdefault.jpg); background-size: cover; background-position: center;`,
          content: '<div style="position: absolute; bottom: 2px; right: 2px; background: rgba(0,0,0,0.7); color: white; padding: 1px 4px; border-radius: 2px; font-size: 8px;"></div>'
        };
      }
      return {
        style: 'background: linear-gradient(135deg, #ff0000 0%, #cc0000 100%);',
        content: '<div style="display: flex; align-items: center; justify-content: center; height: 100%; font-size: 20px; color: white;">미리보기 없음</div>'
      };
    default:
      return {
        style: 'background: #f8f9fa;',
        content: '<div style="display: flex; align-items: center; justify-content: center; height: 100%; font-size: 20px; color: #999;">미리보기 없음</div>'
      };
  }
}

// Extract YouTube video ID
function extractYouTubeId(url) {
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

// Get preview content for theme card
function getPreviewContent(item, type) {
  if (type === 'background') {
    switch (item.type) {
      case 'none': return '미리보기 없음';
      default: return '미리보기 없음';
    }
  } else {
    // 음악의 경우 실제 스펙트럼 분석 결과 표시
    return createAudioSpectrum(item);
  }
}

// Create audio spectrum visualization from actual audio analysis
function createAudioSpectrum(musicItem) {
  const spectrumContainer = document.createElement('div');
  spectrumContainer.className = 'audio-spectrum';
  spectrumContainer.dataset.musicId = musicItem.id;
  
  // 스펙트럼 바 개수 (카드 너비에 맞게 조정)
  const barCount = 24;
  
  // 초기 로딩 상태 표시
  for (let i = 0; i < barCount; i++) {
    const bar = document.createElement('div');
    bar.className = 'spectrum-bar loading';
    bar.style.setProperty('--base-height', '5px');
    bar.style.setProperty('--max-height', '10px');
    spectrumContainer.appendChild(bar);
  }
  
  // 실제 음악 파일 분석 (비동기)
  analyzeAudioFile(musicItem)
    .then(spectrumData => {
      updateSpectrumDisplay(spectrumContainer, spectrumData);
    })
    .catch(error => {
      console.log('Audio analysis failed, using fallback pattern:', error);
      // 분석 실패 시 폴백 패턴 사용
      const fallbackData = generateFallbackSpectrum(musicItem.id, musicItem.name);
      updateSpectrumDisplay(spectrumContainer, fallbackData);
    });
  
  return spectrumContainer.outerHTML;
}

// Analyze audio file to extract spectrum data
async function analyzeAudioFile(musicItem) {
  // 캐시 확인
  const cacheKey = `${musicItem.id}_${musicItem.url.substring(0, 50)}`;
  if (spectrumCache.has(cacheKey)) {
    return spectrumCache.get(cacheKey);
  }
  
  // 음악 타입에 따라 다른 처리
  if (musicItem.type === 'file' && musicItem.url.startsWith('data:')) {
    return await analyzeFileAudio(musicItem.url, cacheKey);
  } else if (musicItem.type === 'url') {
    return await analyzeUrlAudio(musicItem.url, cacheKey);
  } else if (musicItem.type === 'youtube') {
    // YouTube는 직접 분석 불가능하므로 URL 기반 패턴 생성
    const fallbackData = generateFallbackSpectrum(musicItem.id, musicItem.name);
    spectrumCache.set(cacheKey, fallbackData);
    return fallbackData;
  }
  
  throw new Error('Unsupported audio type');
}

// Analyze file-based audio (data URL)
async function analyzeFileAudio(dataUrl, cacheKey) {
  try {
    console.log('Starting audio analysis...');
    
    // AudioContext 생성
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Base64 데이터를 ArrayBuffer로 변환
    const response = await fetch(dataUrl);
    const arrayBuffer = await response.arrayBuffer();
    
    console.log('Audio file size:', arrayBuffer.byteLength);
    
    // 오디오 디코딩
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    console.log('Audio decoded - Duration:', audioBuffer.duration, 'Sample Rate:', audioBuffer.sampleRate);
    
    // 정확히 중간 지점 (50%) 한 곳만 분석
    const duration = audioBuffer.duration;
    const sampleRate = audioBuffer.sampleRate;
    const channelData = audioBuffer.getChannelData(0);
    
    // 중간 지점 계산
    const middleTime = duration * 0.5;
    const startSample = Math.floor(middleTime * sampleRate);
    const fftSize = 2048; // 더 작은 크기로 변경
    const endSample = Math.min(startSample + fftSize, channelData.length);
    
    console.log('Analysis range:', startSample, 'to', endSample);
    
    // 중간 구간 추출
    const segment = channelData.slice(startSample, endSample);
    
    console.log('Segment length:', segment.length, 'First few samples:', segment.slice(0, 10));
    
    // 간단한 주파수 분석
    const spectrumData = analyzeFrequencyBands(segment, sampleRate);
    
    console.log('Spectrum data:', spectrumData);
    
    audioContext.close();
    
    // 캐시에 저장
    spectrumCache.set(cacheKey, spectrumData);
    return spectrumData;
    
  } catch (error) {
    console.error('Audio analysis failed:', error);
    throw new Error(`File analysis failed: ${error.message}`);
  }
}

// Simple but effective frequency band analysis
function analyzeFrequencyBands(samples, sampleRate) {
  const N = samples.length;
  const spectrum = new Array(24).fill(0);
  
  console.log('Analyzing', N, 'samples at', sampleRate, 'Hz');
  
  // 각 주파수 대역별로 에너지 계산
  const maxFreq = sampleRate / 2; // Nyquist frequency
  const freqPerBin = maxFreq / 24;
  
  for (let bin = 0; bin < 24; bin++) {
    const startFreq = bin * freqPerBin;
    const endFreq = (bin + 1) * freqPerBin;
    
    let energy = 0;
    let count = 0;
    
    // 해당 주파수 대역의 에너지 계산 (간단한 방법)
    for (let i = 0; i < N; i++) {
      const freq = (i / N) * (sampleRate / 2);
      if (freq >= startFreq && freq < endFreq) {
        energy += Math.abs(samples[i]);
        count++;
      }
    }
    
    // 평균 에너지 계산
    const avgEnergy = count > 0 ? energy / count : 0;
    
    // 에너지를 높이로 변환 (3px ~ 25px)
    const height = Math.max(3, Math.min(25, avgEnergy * 500 + 3));
    spectrum[bin] = height;
  }
  
  // 스펙트럼 정규화 (최대값이 너무 작으면 스케일링)
  const maxValue = Math.max(...spectrum);
  if (maxValue < 10) {
    for (let i = 0; i < spectrum.length; i++) {
      spectrum[i] = Math.max(3, spectrum[i] * 2);
    }
  }
  
  console.log('Final spectrum:', spectrum);
  return spectrum;
}

// Real FFT implementation for better spectrum analysis
function performRealFFT(samples) {
  console.log('Using performRealFFT - this should not be called anymore');
  const N = samples.length;
  const spectrum = new Array(24).fill(0);
  
  // 윈도우 함수 적용 (Hamming window)
  const windowedSamples = samples.map((sample, i) => {
    const window = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (N - 1));
    return sample * window;
  });
  
  // 각 주파수 구간별로 FFT 계산
  const binSize = Math.floor(N / 48); // 더 세밀한 분석
  
  for (let bin = 0; bin < 24; bin++) {
    let realSum = 0;
    let imagSum = 0;
    const freq = bin * 2; // 저주파수 부분을 더 세밀하게
    
    for (let i = 0; i < N; i += binSize) {
      const angle = -2 * Math.PI * freq * i / N;
      realSum += windowedSamples[i] * Math.cos(angle);
      imagSum += windowedSamples[i] * Math.sin(angle);
    }
    
    // 크기 계산 (magnitude)
    const magnitude = Math.sqrt(realSum * realSum + imagSum * imagSum);
    
    // 로그 스케일 적용하여 높이 계산 (3px ~ 28px)
    const logMagnitude = Math.log(magnitude + 1);
    spectrum[bin] = Math.max(3, Math.min(28, logMagnitude * 8 + 3));
  }
  
  return spectrum;
}

// Analyze URL-based audio
async function analyzeUrlAudio(url, cacheKey) {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Cross-origin 이슈로 인해 실제 분석이 어려울 수 있음
    // 일단 URL 기반 패턴 생성
    const fallbackData = generateFallbackSpectrum(url.length, url);
    spectrumCache.set(cacheKey, fallbackData);
    return fallbackData;
    
  } catch (error) {
    throw new Error(`URL analysis failed: ${error.message}`);
  }
}

// Generate fallback spectrum pattern
function generateFallbackSpectrum(seed, name) {
  console.log('Using fallback spectrum for:', name);
  
  const spectrum = new Array(24);
  const actualSeed = (seed || 0) + (name ? name.length * 7 : 0);
  
  for (let i = 0; i < 24; i++) {
    // 더 복잡한 패턴 생성
    const pseudoRandom1 = (actualSeed + i * 31) % 97;
    const pseudoRandom2 = (actualSeed + i * 13) % 73;
    const pseudoRandom3 = (actualSeed + i * 7) % 61;
    
    const position = i / 23;
    
    // 음악 장르별 다른 패턴 시뮬레이션
    let pattern;
    if (actualSeed % 5 === 0) {
      // 클래식/어쿠스틱 패턴 (중고음 강조)
      pattern = Math.exp(-Math.pow(position - 0.4, 2) * 8);
    } else if (actualSeed % 5 === 1) {
      // 일렉트로닉 패턴 (저음 강조)
      pattern = Math.exp(-Math.pow(position - 0.2, 2) * 5);
    } else if (actualSeed % 5 === 2) {
      // 록 패턴 (중음 강조)
      pattern = Math.exp(-Math.pow(position - 0.5, 2) * 6);
    } else if (actualSeed % 5 === 3) {
      // 팝 패턴 (균등한 분포)
      pattern = 1 - Math.abs(position - 0.5) * 1.2;
    } else {
      // 재즈/복합 패턴 (여러 피크)
      pattern = (Math.exp(-Math.pow(position - 0.3, 2) * 10) + 
                Math.exp(-Math.pow(position - 0.7, 2) * 10)) * 0.6;
    }
    
    // 랜덤 변화 추가
    const randomFactor = (pseudoRandom1 + pseudoRandom2 + pseudoRandom3) / (97 + 73 + 61);
    const finalPattern = pattern * (0.5 + randomFactor * 0.7);
    
    // 높이 계산 (5px ~ 22px)
    spectrum[i] = Math.floor(5 + finalPattern * 17);
  }
  
  console.log('Generated fallback spectrum:', spectrum);
  return spectrum;
}

// Update spectrum display with analyzed data
function updateSpectrumDisplay(container, spectrumData) {
  // DOM에서 실제 컨테이너 찾기 (outerHTML로 생성된 후라서)
  const actualContainer = document.querySelector(`[data-music-id="${container.dataset.musicId}"]`);
  const targetContainer = actualContainer || container;
  
  const bars = targetContainer.querySelectorAll('.spectrum-bar');
  
  console.log('Updating spectrum display with', spectrumData.length, 'data points for', bars.length, 'bars');
  
  bars.forEach((bar, index) => {
    if (index < spectrumData.length) {
      const height = Math.round(spectrumData[index]);
      bar.classList.remove('loading');
      
      // 정적인 높이 설정 (애니메이션 제거)
      bar.style.height = `${height}px`;
      bar.style.setProperty('--static-height', `${height}px`);
      
      // 애니메이션 완전히 제거
      bar.style.animation = 'none';
      
      console.log(`Bar ${index}: ${height}px`);
    }
  });
}

// Get type text
function getTypeText(type) {
  const typeMap = {
    'none': '배경 없음',
    'image': '이미지',
    'video': '동영상',
    'youtube': 'YouTube',
    'file': '파일',
    'url': 'URL'
  };
  return typeMap[type] || type;
}

// Select item
async function selectItem(id, type) {
  if (type === 'background') {
    activeBackgroundId = id;
    renderBackgrounds();
  } else {
    activeMusicId = id;
    renderMusic();
  }
  
  await saveData();
  await updateContentScript();
}

// Delete item
async function deleteItem(id, type) {
  pendingDeleteId = id;
  pendingDeleteType = type;
  deleteModalTitle.textContent = `이 ${type === 'background' ? '배경' : '음악'}을 삭제하시겠습니까?`;
  deleteModalMessage.textContent = `선택한 ${type === 'background' ? '배경' : '음악'}을 삭제합니다. 이 작업은 되돌릴 수 없습니다.`;
  deleteModal.style.display = 'block';
}

// Save settings
async function saveSettings() {
  try {
    await chrome.storage.local.set({
      [STORAGE_KEYS.MUSIC_ENABLED]: musicEnabled.checked,
      [STORAGE_KEYS.MUSIC_VOLUME]: volumeSlider.value / 100
    });
    
    await updateContentScript();
  } catch (error) {
    console.error('Error saving settings:', error);
  }
}

// Save data
async function saveData() {
  try {
    await chrome.storage.local.set({
      [STORAGE_KEYS.BACKGROUNDS]: backgrounds,
      [STORAGE_KEYS.MUSIC_ITEMS]: musicItems,
      [STORAGE_KEYS.ACTIVE_BACKGROUND]: activeBackgroundId,
      [STORAGE_KEYS.ACTIVE_MUSIC]: activeMusicId,
      [STORAGE_KEYS.MUSIC_ENABLED]: musicEnabled.checked,
      [STORAGE_KEYS.MUSIC_VOLUME]: volumeSlider.value / 100
    });
  } catch (error) {
    console.error('Error saving data:', error);
  }
}

// Load data
async function loadData() {
  try {
    const result = await chrome.storage.local.get([
      STORAGE_KEYS.BACKGROUNDS,
      STORAGE_KEYS.MUSIC_ITEMS,
      STORAGE_KEYS.ACTIVE_BACKGROUND,
      STORAGE_KEYS.ACTIVE_MUSIC,
      STORAGE_KEYS.MUSIC_ENABLED,
      STORAGE_KEYS.MUSIC_VOLUME
    ]);

    backgrounds = result[STORAGE_KEYS.BACKGROUNDS] || [];
    musicItems = result[STORAGE_KEYS.MUSIC_ITEMS] || [];
    activeBackgroundId = result[STORAGE_KEYS.ACTIVE_BACKGROUND] || null;
    activeMusicId = result[STORAGE_KEYS.ACTIVE_MUSIC] || null;
    
    // Load UI settings
    if (result[STORAGE_KEYS.MUSIC_ENABLED] !== undefined) {
      musicEnabled.checked = result[STORAGE_KEYS.MUSIC_ENABLED];
    }

    if (result[STORAGE_KEYS.MUSIC_VOLUME] !== undefined) {
      volumeSlider.value = result[STORAGE_KEYS.MUSIC_VOLUME] * 100;
      volumeValue.textContent = Math.round(result[STORAGE_KEYS.MUSIC_VOLUME] * 100);
    }

    // Render themes
    renderBackgrounds();
    renderMusic();
    
  } catch (error) {
    console.error('Error loading data:', error);
  }
}

// Update content script
async function updateContentScript() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tab && tab.url && tab.url.includes('playentry.org')) {
      // Update background
      const activeBackground = backgrounds.find(bg => bg.id === activeBackgroundId);
      if (activeBackground) {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            action: 'updateBackground',
            url: activeBackground.url,
            type: activeBackground.type
          });
        } catch (error) {
          console.log('Background update failed:', error);
        }
      }
      
      // Update music
      const activeMusic = musicItems.find(music => music.id === activeMusicId);
      if (activeMusic && musicEnabled.checked) {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            action: 'updateMusic',
            url: activeMusic.url,
            type: activeMusic.type,
            musicTitle: activeMusic.name,
            volume: volumeSlider.value / 100,
            enabled: true
          });
        } catch (error) {
          console.log('Music update failed:', error);
        }
        } else {
        // Stop music if disabled or no active music
        try {
          await chrome.tabs.sendMessage(tab.id, {
            action: 'updateMusic',
            url: '',
            type: '',
            musicTitle: '',
            volume: 0,
            enabled: false
          });
        } catch (error) {
          console.log('Music stop failed:', error);
        }
      }
    }
  } catch (error) {
    console.log('Could not update content script:', error);
  }
}

// Show status message
function showStatus(message, type = 'info') {
  status.textContent = message;
  status.className = `status show ${type}`;
  
  setTimeout(() => {
    status.classList.remove('show');
  }, 2000);
}

// Make deleteItem function global for onclick handlers
window.deleteItem = deleteItem;

// Setup file upload auto-save functionality
function setupFileUploadListeners() {
  // Background file uploads
  const bgImageFileInput = document.getElementById('bg-image-file-input');
  const bgVideoFileInput = document.getElementById('bg-video-file-input');
  
  // Music file upload
  const musicFileInput = document.getElementById('music-file-input');

  if (bgImageFileInput) {
    bgImageFileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        await autoSaveBackgroundFile(file, 'image');
      }
    });
  }

  if (bgVideoFileInput) {
    bgVideoFileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        await autoSaveBackgroundFile(file, 'video');
      }
    });
  }

  if (musicFileInput) {
    musicFileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        await autoSaveMusicFile(file);
      }
    });
  }
}

// Auto-save background file
async function autoSaveBackgroundFile(file, type) {
  try {
    showStatus('파일 업로드 중...', 'info');
    
    // Check if user already entered a name
    const nameInput = document.getElementById('background-name');
    let finalName = nameInput.value.trim();
    
    // If no name entered, generate from filename
    if (!finalName) {
      const fileName = file.name;
      const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
      finalName = `${nameWithoutExt}`;
      nameInput.value = finalName;
    }
    
    // Select the correct radio button
    const radioId = type === 'image' ? 'bg-image-file' : 'bg-video-file';
    document.getElementById(radioId).checked = true;
    updateOptionVisibility('background');
    
    // Convert file to data URL
    const dataUrl = await fileToDataURL(file);
    
    // Create background object
    const background = {
      id: Date.now(),
      name: finalName,
      type: type,
      url: dataUrl
    };

    // Save to backgrounds array
    backgrounds.push(background);
    await saveData();
    renderBackgrounds();
    closeModal('background');
    
    showStatus('배경 자동 저장 완료', 'success');
    
  } catch (error) {
    console.error('Error auto-saving background file:', error);
    showStatus('파일 저장 실패', 'error');
  }
}

// Auto-save music file
async function autoSaveMusicFile(file) {
  try {
    showStatus('음악 파일 업로드 중...', 'info');
    
    // Check if user already entered a name
    const nameInput = document.getElementById('music-name');
    let finalName = nameInput.value.trim();
    
    // If no name entered, generate from filename
    if (!finalName) {
      const fileName = file.name;
      const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
      finalName = nameWithoutExt;
      nameInput.value = finalName;
    }
    
    // Select the file radio button
    document.getElementById('music-file').checked = true;
    updateOptionVisibility('music');
    
    // Convert file to data URL
    const dataUrl = await fileToDataURL(file);
    
    // Create music object
    const music = {
      id: Date.now(),
      name: finalName,
      type: 'file',
      url: dataUrl
    };

    // Save to music items array
    musicItems.push(music);
    await saveData();
    renderMusic();
    closeModal('music');
    
    showStatus('음악 자동 저장 완료', 'success');
    
  } catch (error) {
    console.error('Error auto-saving music file:', error);
    showStatus('음악 파일 저장 실패', 'error');
  }
}

// Setup delete modal event listeners
function setupDeleteModalControls() {
  confirmDeleteBtn.addEventListener('click', () => {
    performDelete();
  });
  
  cancelDeleteBtn.addEventListener('click', () => {
    closeDeleteModal();
  });
  
  closeDeleteModalBtn.addEventListener('click', () => {
    closeDeleteModal();
  });
  
  // Close modal when clicking outside
  deleteModal.addEventListener('click', (e) => {
    if (e.target === deleteModal) {
      closeDeleteModal();
    }
  });
}

// Close delete modal
function closeDeleteModal() {
  deleteModal.style.display = 'none';
  pendingDeleteId = null;
  pendingDeleteType = null;
}

// Perform actual delete
async function performDelete() {
  if (!pendingDeleteId || !pendingDeleteType) return;
  
  try {
    if (pendingDeleteType === 'background') {
      backgrounds = backgrounds.filter(bg => bg.id !== pendingDeleteId);
      if (activeBackgroundId === pendingDeleteId) {
        activeBackgroundId = null;
      }
      renderBackgrounds();
    } else {
      musicItems = musicItems.filter(music => music.id !== pendingDeleteId);
      if (activeMusicId === pendingDeleteId) {
        activeMusicId = null;
      }
      renderMusic();
    }
    
    await saveData();
    await updateContentScript();
    closeDeleteModal();
    showStatus('삭제 완료', 'success');
  } catch (error) {
    console.error('Error deleting item:', error);
    showStatus('삭제 실패', 'error');
    closeDeleteModal();
  }
}

// Simple FFT implementation for fallback
function performFFT(samples) {
  const N = samples.length;
  const spectrum = new Array(24).fill(0);
  
  // 간단한 주파수 구간별 에너지 계산
  const binSize = Math.floor(N / 24);
  
  for (let i = 0; i < 24; i++) {
    let energy = 0;
    const start = i * binSize;
    const end = Math.min(start + binSize, N);
    
    for (let j = start; j < end; j++) {
      energy += Math.abs(samples[j]);
    }
    
    // 에너지를 높이로 변환 (5px ~ 30px)
    spectrum[i] = Math.max(5, Math.min(30, energy * 1000 + 5));
  }
  
  return spectrum;
} 