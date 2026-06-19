// Global Application State Configuration
window.currentView = 'home';
window.currentMalId = null;
window.currentLanguage = 'sub'; // Default to subtitled content
window.currentServer = 'mal';   // Default server source
window.currentEpisode = 1;
window.activeScheduleDay = 'today';

// Hardcoded backend link for your custom AniVexa API mapping/streaming
const ANIVEXA_BASE_API = "https://anivexa-api-eta.vercel.app";

// Character Theme Palette Configuration Data (Re:Zero Layouts)
const characterPresets = {
  subaru: { text: '#f97316', bg: '#f97316' },
  emilia: { text: '#c084fc', bg: '#c084fc' },
  rem: { text: '#38bdf8', bg: '#38bdf8' },
  ram: { text: '#fb7185', bg: '#fb7185' },
  beatrice: { text: '#fbbf24', bg: '#fbbf24' },
  felt: { text: '#eab308', bg: '#eab308' },
  reinhard: { text: '#dc2626', bg: '#dc2626' },
  crusch: { text: '#059669', bg: '#059669' },
  felix: { text: '#d97706', bg: '#d97706' },
  priscilla: { text: '#ef4444', bg: '#ef4444' },
  anastasia: { text: '#f472b6', bg: '#f472b6' },
  julius: { text: '#818cf8', bg: '#818cf8' },
  wilhelm: { text: '#94a3b8', bg: '#94a3b8' },
  roswaal: { text: '#4f46e5', bg: '#4f46e5' },
  satella: { text: '#6d28d9', bg: '#6d28d9' },
  echidna: { text: '#d4d4d8', bg: '#d4d4d8' }
};

// Application Initialization Natively Executed on Window Load
window.addEventListener('DOMContentLoaded', () => {
  initClock();
  applySavedTheme();
  fetchLandingTrendingData();
  setupCalendarSearch();
});

// Real-Time 24-Hour Clock Loop Setup (JST Mode Synchronization)
function initClock() {
  setInterval(() => {
    const clockEl = document.getElementById('live-24h-clock');
    if (!clockEl) return;
    const now = new Date();
    const jstOffset = 9 * 60 * 60 * 1000;
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const jstTime = new Date(utc + jstOffset);
    
    const hrs = String(jstTime.getHours()).padStart(2, '0');
    const mins = String(jstTime.getMinutes()).padStart(2, '0');
    const secs = String(jstTime.getSeconds()).padStart(2, '0');
    clockEl.textContent = `${hrs}:${mins}:${secs} JST`;
  }, 1000);
}

// Navigation View Routing Management System
function switchToView(viewName) {
  window.currentView = viewName;
  
  // Target blocks definition
  const views = {
    home: document.getElementById('main-exploration-hub'),
    catalog: document.getElementById('main-exploration-hub'),
    releases: document.getElementById('releases-focus-view'),
    calendar: document.getElementById('calendar-focus-view'),
    stream: document.getElementById('stream-dashboard-box')
  };

  const landingPortal = document.getElementById('landing-portal');
  const headerSearch = document.getElementById('header-search-engine');
  const viewIndicator = document.getElementById('view-indicator-title');

  // Clear previous active states on side menu elements
  document.querySelectorAll('.sidebar-item').forEach(item => item.classList.remove('active', 'dynamic-accent-bg', 'text-black'));
  
  // Set explicit display toggles
  Object.keys(views).forEach(key => {
    if (views[key]) views[key].classList.add('hidden');
  });

  if (landingPortal) landingPortal.classList.add('hidden');
  if (headerSearch) headerSearch.classList.add('hidden');

  // Trigger targeted presentation modules
  if (viewName === 'home') {
    if (landingPortal) landingPortal.classList.remove('hidden');
    if (views.home) views.home.classList.remove('hidden');
    const targetNav = document.getElementById('side-nav-home');
    if (targetNav) targetNav.classList.add('active');
    if (viewIndicator) viewIndicator.textContent = "Welcome Portal";
  } else if (viewName === 'catalog') {
    if (headerSearch) headerSearch.classList.remove('hidden');
    if (views.catalog) views.catalog.classList.remove('hidden');
    const targetNav = document.getElementById('side-nav-catalog');
    if (targetNav) targetNav.classList.add('active');
    if (viewIndicator) viewIndicator.textContent = "Catalog Browser";
  } else if (viewName === 'releases') {
    if (views.releases) views.releases.classList.remove('hidden');
    const targetNav = document.getElementById('side-nav-releases');
    if (targetNav) targetNav.classList.add('active');
    if (viewIndicator) viewIndicator.textContent = "Fresh Releases Feed";
    fetchLiveReleasesFeed();
  } else if (viewName === 'calendar') {
    if (views.calendar) views.calendar.classList.remove('hidden');
    const targetNav = document.getElementById('side-nav-calendar');
    if (targetNav) targetNav.classList.add('active');
    if (viewIndicator) viewIndicator.textContent = "Airing Schedule Tracker";
    buildCalendarMatrix();
  } else if (viewName === 'stream') {
    if (views.stream) views.stream.classList.remove('hidden');
    if (viewIndicator) viewIndicator.textContent = "Streaming Room";
  }
}

// Global Portal Interface Resets
function homeReturnReset() {
  switchToView('home');
  fetchLandingTrendingData();
}

// Core API Processing: Trending Media Hub Initialization
async function fetchLandingTrendingData() {
  try {
    const res = document.getElementById('results-grid');
    const recScroller = document.getElementById('recommendations-scroller');
    
    // Fallback loading text update hooks
    if (res) res.innerHTML = '<p class="text-xs text-gray-500 animate-pulse">Syncing catalog indexes...</p>';
    
    // Fetch live items via safe public endpoint
    const response = await fetch('https://api.jikan.moe/v4/top/anime?filter=airing&limit=12');
    const data = await response.json();
    
    if (!data || !data.data) throw new Error("Data parsing corruption detected.");
    
    if (res) res.innerHTML = '';
    if (recScroller) recScroller.innerHTML = '';

    data.data.forEach((anime, idx) => {
      const cardHtml = `
        <div onclick="openStreamingConsole(${anime.mal_id})" class="bg-[#121216] border border-neutral-800 rounded-xl overflow-hidden hover:border-neutral-600 transition-all cursor-pointer group shadow-lg">
          <div class="aspect-[3/4] relative w-full bg-neutral-900">
            <img src="${anime.images.jpg.image_url}" alt="${anime.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
            <div class="absolute top-2 left-2 bg-black/80 backdrop-blur text-[10px] font-bold px-2 py-0.5 rounded text-orange-400">★ ${anime.score || 'N/A'}</div>
          </div>
          <div class="p-3 space-y-1">
            <h4 class="text-xs font-semibold text-gray-200 line-clamp-1 group-hover:text-white transition-colors">${anime.title}</h4>
            <p class="text-[10px] text-gray-500 line-clamp-1">${anime.type || 'TV'} • ${anime.episodes || '??'} Eps</p>
          </div>
        </div>
      `;

      if (idx < 4 && recScroller) {
        recScroller.insertAdjacentHTML('beforeend', cardHtml);
      } else if (res) {
        res.insertAdjacentHTML('beforeend', cardHtml);
      }
    });

    fetchScheduleMatrixData();
  } catch (err) {
    console.error("Core Engine Error:", err);
  }
}

// Live Airing Dashboard Calendar Assembly Block
function buildCalendarMatrix() {
  const daysMatrix = document.getElementById('calendar-days-matrix');
  if (!daysMatrix) return;
  daysMatrix.innerHTML = '';
  
  const weeklyLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  weeklyLabels.forEach(day => {
    daysMatrix.insertAdjacentHTML('beforeend', `<div class="text-[10px] uppercase tracking-wider text-gray-500 font-bold py-1">${day}</div>`);
  });

  const now = new Date();
  const currentDayOfWeek = now.getDay();

  for (let i = 0; i < 7; i++) {
    const isToday = i === currentDayOfWeek;
    const buttonClass = isToday 
      ? 'dynamic-accent-bg bg-orange-500 text-black font-bold' 
      : 'bg-dark-input text-gray-400 border border-dark hover:text-white';
      
    daysMatrix.insertAdjacentHTML('beforeend', `
      <button class="py-2 text-xs rounded-lg font-medium transition-all ${buttonClass}">
        ${weeklyLabels[i]}
      </button>
    `);
  }
  
  fetchChronologicalAiringList();
}

async function fetchChronologicalAiringList() {
  const targetList = document.getElementById('airing-chronological-list');
  if (!targetList) return;
  targetList.innerHTML = '<div class="text-center py-6 text-xs text-gray-500 animate-pulse"><i class="fa-solid fa-circle-notch animate-spin text-orange-500 mr-2"></i>Parsing complete weekly calendar blocks...</div>';

  try {
    const response = await fetch('https://api.jikan.moe/v4/schedules?limit=20');
    const data = await response.json();
    if (!data || !data.data) return;

    targetList.innerHTML = '';
    data.data.slice(0, 15).forEach(anime => {
      targetList.insertAdjacentHTML('beforeend', `
        <div onclick="openStreamingConsole(${anime.mal_id})" class="flex items-center gap-4 bg-dark-card border border-dark p-3 rounded-xl hover:border-neutral-600 cursor-pointer transition-all">
          <img src="${anime.images.jpg.small_image_url}" class="w-12 h-16 object-cover rounded-lg bg-neutral-900 border border-dark">
          <div class="flex-1 min-w-0">
            <h4 class="text-xs font-bold text-white truncate">${anime.title}</h4>
            <p class="text-[11px] text-gray-400 mt-0.5"><i class="fa-regular fa-clock mr-1"></i>Airing Time: ${anime.broadcast.time || 'N/A'} (JST)</p>
          </div>
          <div class="text-right shrink-0">
            <span class="text-[10px] font-mono bg-neutral-900 border border-dark px-2 py-1 rounded text-orange-400">Score: ${anime.score || '--'}</span>
          </div>
        </div>
      `);
    });
  } catch (e) {
    targetList.innerHTML = '<p class="text-xs text-red-400 p-4">Failed to synchronize calendar assets.</p>';
  }
}

// Full Releases Feed Processor
async function fetchLiveReleasesFeed() {
  const container = document.getElementById('releases-api-grid');
  if (!container) return;
  
  try {
    const res = await fetch('https://api.jikan.moe/v4/seasons/now?limit=20');
    const json = await res.json();
    if (!json || !json.data) return;

    container.innerHTML = '';
    json.data.forEach(anime => {
      container.insertAdjacentHTML('beforeend', `
        <div onclick="openStreamingConsole(${anime.mal_id})" class="bg-dark-card border border-dark rounded-xl overflow-hidden hover:border-neutral-600 transition-all cursor-pointer group shadow-md">
          <div class="aspect-[3/4] relative bg-neutral-900">
            <img src="${anime.images.jpg.image_url}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
          </div>
          <div class="p-2.5">
            <h4 class="text-[11px] font-bold text-gray-200 line-clamp-1 group-hover:text-white">${anime.title}</h4>
            <p class="text-[10px] text-gray-500 mt-0.5 truncate">${anime.genres?.[0]?.name || 'Anime'} • Episode ${anime.episodes || 'New'}</p>
          </div>
        </div>
      `);
    });
  } catch (err) {
    container.innerHTML = '<p class="text-xs text-center col-span-full py-8 text-gray-500">Failed parsing streaming data frames.</p>';
  }
}

// Sidebar Broadcast Matrix Processing Elements
async function fetchScheduleMatrixData() {
  const scheduleBox = document.getElementById('schedule-box');
  const topBox = document.getElementById('top10-box');
  if (scheduleBox) scheduleBox.innerHTML = '<p class="text-[11px] text-gray-600">Reindexing broadcast dates...</p>';

  try {
    const res = await fetch('https://api.jikan.moe/v4/schedules?limit=6');
    const json = await res.json();
    
    if (scheduleBox && json.data) {
      scheduleBox.innerHTML = '';
      json.data.forEach(item => {
        scheduleBox.insertAdjacentHTML('beforeend', `
          <div onclick="openStreamingConsole(${item.mal_id})" class="flex items-center justify-between p-2 bg-dark-input/40 border border-dark/50 rounded-lg hover:border-neutral-700 cursor-pointer transition-colors">
            <span class="truncate font-medium text-gray-300 pr-2 max-w-[140px]">${item.title}</span>
            <span class="text-[10px] font-mono text-orange-400 bg-neutral-900/80 px-1.5 py-0.5 rounded">${item.broadcast.time || '00:00'}</span>
          </div>
        `);
      });
    }

    if (topBox) {
      topBox.innerHTML = '';
      const topRes = await fetch('https://api.jikan.moe/v4/top/anime?limit=5');
      const topJson = await topRes.json();
      
      topJson.data.forEach((item, index) => {
        topBox.insertAdjacentHTML('beforeend', `
          <div onclick="openStreamingConsole(${item.mal_id})" class="flex items-center gap-3 cursor-pointer group">
            <span class="font-black text-sm text-gray-600 group-hover:text-orange-500 w-4 transition-colors">0${index + 1}</span>
            <div class="flex-1 min-w-0">
              <h4 class="text-xs text-gray-300 group-hover:text-white font-medium truncate">${item.title}</h4>
              <p class="text-[10px] text-gray-500">${item.score || '9.0'} Ranking Metric</p>
            </div>
          </div>
        `);
      });
    }
  } catch(e) {
    console.warn("Sidebar data processing interrupted.");
  }
}

// Integrated Execution Framework for Streaming Infrastructure
async function openStreamingConsole(malId) {
  window.currentMalId = malId;
  window.currentEpisode = 1;
  switchToView('stream');
  
  const detailTitle = document.getElementById('detail-title');
  const detailSynopsis = document.getElementById('detail-synopsis');
  const detailPoster = document.getElementById('detail-poster');
  
  if (detailTitle) detailTitle.textContent = "Loading Record Blocks...";
  if (detailSynopsis) detailSynopsis.textContent = "Waiting for remote sync handshake configuration tracks...";

  try {
    const res = await fetch(`https://api.jikan.moe/v4/anime/${malId}`);
    const json = await res.json();
    const data = json.data;

    if (detailTitle) detailTitle.textContent = data.title;
    if (detailSynopsis) detailSynopsis.textContent = data.synopsis || "No data description log found on record channels.";
    if (detailPoster) detailPoster.src = data.images.jpg.image_url;

    document.getElementById('detail-type').textContent = data.type || '--';
    document.getElementById('detail-episodes').textContent = data.episodes || '--';
    document.getElementById('detail-rating').textContent = data.rating ? data.rating.split(' ')[0] : '--';

    buildEpisodeControlInterface(data.episodes || 12);
    launchVideoPlayer(1);
  } catch (err) {
    if (detailTitle) detailTitle.textContent = "Synchronization Failed";
  }
}

// Multi-Source Video Content Player Router Engine
async function launchVideoPlayer(epNum) {
  window.currentEpisode = epNum;
  
  // Highlight active selector tracking metrics natively
  document.querySelectorAll('.ep-btn').forEach(btn => {
    btn.classList.remove('dynamic-accent-bg', 'text-black', 'bg-orange-500');
    btn.classList.add('bg-dark-input', 'text-gray-400');
    if (parseInt(btn.getAttribute('data-ep')) === epNum) {
      btn.classList.remove('bg-dark-input', 'text-gray-400');
      btn.classList.add('dynamic-accent-bg', 'bg-orange-500', 'text-black');
    }
  });

  const iframe = document.getElementById('video-iframe');
  const noticeOverlay = document.getElementById('notice-overlay');
  if (!iframe) return;

  // Clear previous execution targets securely
  iframe.src = ""; 
  updateServerButtonHighlights();

  // ROUTER SELECTION LOGIC
  if (window.currentServer === 'mal') {
    if (noticeOverlay) noticeOverlay.classList.add('hidden');
    iframe.classList.remove('hidden');
    iframe.src = `https://myanimelist.net/anime/${window.currentMalId}`;
  } 
  else if (window.currentServer === 'cdn-9anime') {
    if (noticeOverlay) noticeOverlay.classList.add('hidden');
    iframe.classList.remove('hidden');
    iframe.src = `https://vidsrc.me/embed/anime?mal=${window.currentMalId}&ep=${epNum}`;
  } 
  else if (window.currentServer === 'anivexa') {
    // RUNNING IN ANIVEXA MODE - Keep selection highlighted for manual Vercel debugging
    if (noticeOverlay) noticeOverlay.classList.add('hidden');
    iframe.classList.remove('hidden');
    
    // Direct link matching your API endpoint structure
    iframe.src = `${ANIVEXA_BASE_API}/watch/anidbapp/${window.currentMalId}/${window.currentLanguage}/anidbapp-${epNum}`;
    
    console.log(`[AniVexa Debug Router Target]: ${iframe.src}`);
  } 
  else if (window.currentServer === 'consumet') {
    if (noticeOverlay) noticeOverlay.classList.add('hidden');
    iframe.classList.remove('hidden');
    iframe.src = `https://anitaku.to/embed/episode/${window.currentMalId}-${epNum}`;
  }
}

// AniVexa Endpoint Fallback Processing Hook
async function fetchAnidbAppStream(malId, epNum, lang) {
  try {
    const targetUrl = `${ANIVEXA_BASE_API}/map/${malId}`;
    const response = await fetch(targetUrl);
    if (!response.ok) return null;
    const mappingData = await response.json();
    
    if (mappingData && mappingData.streamUrl) {
      return mappingData.streamUrl;
    }
    return null;
  } catch (e) {
    console.error("AniVexa Network Processing Exception:", e);
    return null;
  }
}

// Global Core Fallback Engine Configuration
function handleAutomaticFallback() {
  console.warn("Active server channel failure detected. Switching source tracks to Consumet backend stack...");
  window.currentServer = 'consumet';
  launchVideoPlayer(window.currentEpisode);
}

// Server Selector Tab Synchronization Logic 
function updateServerButtonHighlights() {
  const servers = ['mal', 'cdn-9anime', 'anivexa', 'consumet'];
  servers.forEach(srv => {
    const btn = document.getElementById(`server-${srv}`);
    if (!btn) return;
    btn.className = "text-[11px] font-mono py-1 px-3 rounded border transition-colors";
    
    if (window.currentServer === srv) {
      btn.classList.add('dynamic-accent-bg', 'bg-orange-500', 'text-black', 'font-bold', 'border-transparent');
    } else {
      btn.classList.add('bg-dark-input', 'text-gray-400', 'border-dark', 'hover:text-white');
    }
  });
}

function setServerSource(sourceKey) {
  window.currentServer = sourceKey;
  launchVideoPlayer(window.currentEpisode);
}

function setLanguage(langKey) {
  window.currentLanguage = langKey;
  
  const subBtn = document.getElementById('sub-btn');
  const dubBtn = document.getElementById('dub-btn');
  
  if(subBtn && dubBtn) {
    subBtn.className = "text-xs font-bold px-4 py-1.5 rounded-l-md transition-colors";
    dubBtn.className = "text-xs font-bold px-4 py-1.5 rounded-r-md border border-dark transition-colors";
    
    if (langKey === 'sub') {
      subBtn.classList.add('dynamic-accent-bg', 'bg-orange-500', 'text-black');
      dubBtn.classList.add('bg-dark-input', 'text-gray-400');
    } else {
      dubBtn.classList.add('dynamic-accent-bg', 'bg-orange-500', 'text-black');
      subBtn.classList.add('bg-dark-input', 'text-gray-400');
    }
  }
  launchVideoPlayer(window.currentEpisode);
}

// Programmatic Assembly for Episode Grid Block Matrix
function buildEpisodeControlInterface(totalCount) {
  const container = document.getElementById('episode-buttons');
  if (!container) return;
  container.innerHTML = '';

  const total = totalCount || 12;
  for (let i = 1; i <= total; i++) {
    const btn = document.createElement('button');
    btn.textContent = i;
    btn.setAttribute('data-ep', i);
    btn.className = "ep-btn w-10 h-10 rounded-lg text-xs font-bold font-mono transition-all flex items-center justify-center border border-dark/60 bg-dark-input text-gray-400 hover:border-neutral-500";
    btn.onclick = () => launchVideoPlayer(i);
    container.appendChild(btn);
  }
}

// Global Portal Navigation Engine Core Logic Search Interceptors
function triggerCatalogSearch(isFromHeader) {
  const inputId = isFromHeader ? 'header-search-input' : 'search-input';
  const query = document.getElementById(inputId)?.value.trim();
  
  if (!query) return;
  
  switchToView('catalog');
  const gridHeader = document.getElementById('grid-header-title');
  if (gridHeader) gridHeader.textContent = `Search Results: "${query}"`;
  
  executeCatalogApiSearch(query);
}

async function executeCatalogApiSearch(query) {
  const grid = document.getElementById('results-grid');
  if (!grid) return;
  grid.innerHTML = '<div class="col-span-full text-center py-12 text-xs text-gray-500 animate-pulse"><i class="fa-solid fa-compass animate-spin text-orange-500 text-lg mb-2 block"></i>Interrogating remote record systems...</div>';

  try {
    const res = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=16`);
    const json = await res.json();
    
    if(!json.data || json.data.length === 0) {
      grid.innerHTML = '<p class="col-span-full text-center py-12 text-xs text-gray-500">No media assets found corresponding to the parameter criteria.</p>';
      return;
    }

    grid.innerHTML = '';
    json.data.forEach(anime => {
      grid.insertAdjacentHTML('beforeend', `
        <div onclick="openStreamingConsole(${anime.mal_id})" class="bg-[#121216] border border-neutral-800 rounded-xl overflow-hidden hover:border-neutral-600 transition-all cursor-pointer group shadow-lg">
          <div class="aspect-[3/4] relative w-full bg-neutral-900">
            <img src="${anime.images.jpg.image_url}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
          </div>
          <div class="p-3">
            <h4 class="text-xs font-semibold text-gray-200 line-clamp-1 group-hover:text-white">${anime.title}</h4>
            <p class="text-[10px] text-gray-500 mt-0.5">${anime.type || 'TV'} • Score: ${anime.score || 'N/A'}</p>
          </div>
        </div>
      `);
    });
  } catch(e) {
    grid.innerHTML = '<p class="col-span-full text-center py-12 text-xs text-red-400">Search execution framework processing failure.</p>';
  }
}

function setupCalendarSearch() {
  const calInput = document.getElementById('calendar-search');
  if (!calInput) return;
  calInput.addEventListener('input', (e) => {
    const val = e.target.value.toLowerCase();
    console.log(`Filtering visual schedules matching sequence: ${val}`);
  });
}

// Side Drawers, Overlays and UI State Utilities
function toggleMainMenu() {
  const menu = document.getElementById('main-menu-drawer');
  const overlay = document.getElementById('menu-overlay');
  if (!menu || !overlay) return;

  if (menu.classList.contains('-translate-x-full')) {
    menu.classList.remove('-translate-x-full');
    overlay.classList.remove('hidden');
  } else {
    menu.classList.add('-translate-x-full');
    overlay.classList.add('hidden');
  }
}

function openBottomSheet() {
  const sheet = document.getElementById('bottom-sheet-menu');
  const overlay = document.getElementById('sheet-overlay');
  if(sheet && overlay) {
    sheet.classList.remove('translate-y-full');
    overlay.classList.remove('hidden');
  }
}

// Interface Theme Configurations & Active Preset Persistences
function closeBottomSheet() {
  const sheet = document.getElementById('bottom-sheet-menu');
  const overlay = document.getElementById('sheet-overlay');
  if(sheet && overlay) {
    sheet.classList.add('translate-y-full');
    overlay.classList.add('hidden');
  }
}

function applyCharacterPreset(key) {
  const colors = characterPresets[key];
  if (!colors) return;

  localStorage.setItem('theDude9_theme_preset', key);
  injectDynamicThemeStyles(colors.text, colors.bg);
}

function injectDynamicThemeStyles(textColor, bgColor) {
  let styleEl = document.getElementById('dynamic-theme-injected-block');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'dynamic-theme-injected-block';
    document.head.appendChild(styleEl);
  }

  styleEl.innerHTML = `
    .dynamic-accent-text { color: ${textColor} !important; }
    .dynamic-accent-bg { background-color: ${bgColor} !important; }
    .dynamic-focus-border:focus { border-color: ${bgColor} !important; }
    .sidebar-item.active { background-color: ${bgColor} !important; color: #000000 !important; }
  `;
}

function applySavedTheme() {
  const saved = localStorage.getItem('theDude9_theme_preset') || 'subaru';
  applyCharacterPreset(saved);
}
