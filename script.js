const JIKAN_BASE = "https://api.jikan.moe/v4";

// ==========================================
// 1. GLOBAL STATE INITIALIZATION
// ==========================================
const ANIVEXA_BASE_API = "https://anivexa-api-eta.vercel.app";

const PROVIDER_BASES = {
  megaplay: "https://megaplay.buzz/stream/mal"
};

// Updated list tracking all available backend providers
const API_PROVIDERS = [
  { id: 'megaplay', name: 'MegaPlay' },
  { id: 'allmanga', name: 'AllManga' },
  { id: 'reanime', name: 'ReAnime' },
  { id: 'anikoto', name: 'AniKoto' },
  { id: 'animegg', name: 'AnimeGG' },
  { id: 'anineko', name: 'AniNeko' },
  { id: 'anidbapp', name: 'AniDB App' },
  { id: 'animepahe', name: 'AnimePahe' }
];

let activeProviderKey = 'megaplay'; 
let currentEpisodeIndex = 1;
let currentLanguage = 'sub';
let plyrInstance = null;
let streamLoadGuard = null;

// Guard items to stop loop updates on view toggle
let hubFeedsLoaded = false;
let recentReleasesLoaded = false;
let calendarLoaded = false;
let currentPresetName = 'subaru';
let selectedDayFilter = '';

// Store the fetched server episode mapping objects globally so we can access real API data IDs
let globalEpisodeDataCache = null;

window.currentMalId = "";
window.currentAnilistId = "";
window.activeAnimeTitle = "";
window.activeMaxEpisodes = 12;
window.activeImgUrl = "";

let activeScheduleDay = 'today';
let calendarCachedDataset = [];
const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const colorProfiles = {
  umi: { hex: '#4169e1', rgb: '65, 105, 225' },
  alya: { hex: '#a1a1aa', rgb: '161, 161, 170' },
  subaru: { hex: '#f97316', rgb: '249, 115, 22' },
  emilia: { hex: '#c084fc', rgb: '192, 132, 252' },
  rem: { hex: '#38bdf8', rgb: '56, 189, 248' },
  ram: { hex: '#fb7185', rgb: '251, 113, 133' },
  beatrice: { hex: '#fbbf24', rgb: '251, 191, 36' },
  felt: { hex: '#eab308', rgb: '234, 179, 8' },
  reinhard: { hex: '#dc2626', rgb: '220, 38, 38' },
  crusch: { hex: '#059669', rgb: '5, 150, 105' },
  felix: { hex: '#d97706', rgb: '217, 119, 6' },
  priscilla: { hex: '#ef4444', rgb: '239, 68, 68' },
  anastasia: { hex: '#f472b6', rgb: '244, 114, 182' },
  julius: { hex: '#818cf8', rgb: '129, 140, 248' },
  wilhelm: { hex: '#94a3b8', rgb: '148, 163, 184' },
  roswaal: { hex: '#4f46e5', rgb: '79, 70, 229' },
  satella: { hex: '#6d28d9', rgb: '109, 40, 217' },
  echidna: { hex: '#e4e4e7', rgb: '228, 228, 231' }
};

// ==========================================
// 2. INTERFACE OPERATIONS MANAGER (UI / VIEWS)
// ==========================================
window.switchToView = function(viewTarget) {
  const sections = [
    'landing-portal',
    'main-exploration-hub',
    'releases-focus-view',
    'calendar-focus-view',
    'stream-dashboard-box'
  ];

  sections.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add('hidden');
      el.classList.remove('block', 'flex');
    }
  });

  const headerSearch = document.getElementById('header-search-engine');
  if (headerSearch) {
    headerSearch.classList.remove('hidden');
    headerSearch.classList.add('flex');
  }

  document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
  const viewTitle = document.getElementById('view-indicator-title');

  if (viewTarget === 'home') {
    const landing = document.getElementById('landing-portal');
    if (landing) {
      landing.classList.remove('hidden');
      landing.classList.add('flex');
    }
    if (headerSearch) {
      headerSearch.classList.add('hidden');
      headerSearch.classList.remove('flex');
    }
    const navHome = document.getElementById('side-nav-home');
    if(navHome) navHome.classList.add('active');
    if(viewTitle) viewTitle.innerText = "Welcome Portal";
  } 
  else if (viewTarget === 'catalog') {
    const catalog = document.getElementById('main-exploration-hub');
    if (catalog) {
      catalog.classList.remove('hidden');
      catalog.classList.add('block');
    }
    
    const recBlock = document.getElementById('recommendations-container-block');
    if (recBlock) recBlock.classList.remove('hidden');
    const sideBlock = document.getElementById('sidebar-container-block');
    if (sideBlock) sideBlock.classList.remove('hidden');

    const splitContainer = document.getElementById('grid-split-container');
    if(splitContainer) splitContainer.className = "lg:col-span-2 space-y-8";
    const headerTitle = document.getElementById('grid-header-title');
    if(headerTitle) headerTitle.innerText = "Trending Media Records";
    const navCatalog = document.getElementById('side-nav-catalog');
    if(navCatalog) navCatalog.classList.add('active');
    if(viewTitle) viewTitle.innerText = "Catalog Exploration Matrix";
    loadMainHubFeeds();
  } 
  else if (viewTarget === 'releases') {
    const releases = document.getElementById('releases-focus-view');
    if (releases) {
      releases.classList.remove('hidden');
      releases.classList.add('block');
    }
    const navReleases = document.getElementById('side-nav-releases');
    if(navReleases) navReleases.classList.add('active');
    if(viewTitle) viewTitle.innerText = "Global Release Streams";
    fetchFullSeasonalReleases();
  } 
  else if (viewTarget === 'calendar') {
    const calendar = document.getElementById('calendar-focus-view');
    if (calendar) {
      calendar.classList.remove('hidden');
      calendar.classList.add('block');
    }
    const navCalendar = document.getElementById('side-nav-calendar');
    if(navCalendar) navCalendar.classList.add('active');
    if(viewTitle) viewTitle.innerText = "Broadcasting Track Scheduler";
    initCalendarTimelineLayout();
  }
}

window.toggleMainMenu = function() {
  const drawer = document.getElementById('main-menu-drawer');
  const overlay = document.getElementById('menu-overlay');
  if (!drawer) return;
  if (drawer.classList.contains('-translate-x-full')) {
    drawer.classList.remove('-translate-x-full');
    if (overlay) overlay.classList.remove('hidden');
  } else {
    drawer.classList.add('-translate-x-full');
    if (overlay) overlay.classList.add('hidden');
  }
}

window.homeReturnReset = function() {
  clearTimeout(streamLoadGuard);
  if(plyrInstance) { 
    try { plyrInstance.destroy(); } catch(e){} 
    plyrInstance = null; 
  }
  window.switchToView('home');
  const sInput = document.getElementById('search-input');
  const hInput = document.getElementById('header-search-input');
  if(sInput) sInput.value = "";
  if(hInput) hInput.value = "";
}

function startSystemClock() {
  setInterval(() => {
    const now = new Date();
    const jstString = now.toLocaleTimeString("en-US", {
      timeZone: "Asia/Tokyo",
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
    const clockEl = document.getElementById('live-24h-clock');
    if (clockEl) clockEl.innerText = `${jstString} JST`;
  }, 1000);
}

window.openBottomSheet = function() {
  const overlay = document.getElementById('sheet-overlay');
  const menu = document.getElementById('bottom-sheet-menu');
  if(overlay) overlay.style.display = 'block';
  if(menu) {
    setTimeout(() => { menu.classList.add('open'); }, 10);
    menu.style.transform = "translateY(0)";
  }
}

window.closeBottomSheet = function() {
  const overlay = document.getElementById('sheet-overlay');
  const menu = document.getElementById('bottom-sheet-menu');
  if(menu) menu.style.transform = "translateY(100%)";
  if(overlay) setTimeout(() => { overlay.style.display = 'none'; }, 300);
}

window.applyCharacterPreset = function(profileKey) {
  const choice = colorProfiles[profileKey];
  if (!choice) return;
  document.documentElement.style.setProperty('--character-accent', choice.hex);
  document.documentElement.style.setProperty('--character-accent-hover', choice.hex);
  document.documentElement.style.setProperty('--character-accent-rgb', choice.rgb);
  currentPresetName = profileKey;
  localStorage.setItem('dude9anime-preset', profileKey);
  
  const streamBox = document.getElementById('stream-dashboard-box');
  if (streamBox && !streamBox.classList.contains('hidden')) {
    updateProviderTabsUI();
  }
  updateLanguageButtonsUI();
}

function loadSavedTheme() {
  const saved = localStorage.getItem('dude9anime-preset');
  if (saved && colorProfiles[saved]) window.applyCharacterPreset(saved);
}

// ==========================================
// 3. API ENGINE CONTEXT IMPLEMENTATION (JIKAN API)
// ==========================================
async function loadMainHubFeeds() {
  fetchLiveReleasingSchedule(activeScheduleDay);
  try {
    const res = await fetch(`${JIKAN_BASE}/seasons/now?limit=22`);
    const json = await res.json();
    const dataset = json.data || [];
    if(dataset.length > 0) {
      displayScrollFeed(dataset.slice(0, 10), 'recommendations-scroller');
      displayGridFeed(dataset.slice(10, 22), 'results-grid');
      displayTop10Sidebar(dataset.slice(0, 10));
    }
  } catch (err) { 
    const grid = document.getElementById('results-grid');
    if(grid) grid.innerHTML = "<p class='text-xs font-mono text-gray-600'>Network engine layout fallback routing triggered.</p>"; 
  }
}

window.triggerCatalogSearch = async function(fromHeader = false) {
  const queryFieldId = fromHeader ? 'header-search-input' : 'search-input';
  const field = document.getElementById(queryFieldId);
  if(!field) return;
  const query = field.value.trim();
  if(!query) return alert("Parameter target strings missing expression parameters.");

  const sInput = document.getElementById('search-input');
  const hInput = document.getElementById('header-search-input');
  if(sInput) sInput.value = query;
  if(hInput) hInput.value = query;

  const landing = document.getElementById('landing-portal');
  if(landing) { landing.classList.add('hidden'); landing.classList.remove('flex'); }
  const streamBox = document.getElementById('stream-dashboard-box');
  if(streamBox) streamBox.classList.add('hidden');
  
  const catalog = document.getElementById('main-exploration-hub');
  if(catalog) { catalog.classList.remove('hidden'); catalog.classList.add('block'); }
  
  const headerSearch = document.getElementById('header-search-engine');
  if(headerSearch) { headerSearch.classList.remove('hidden'); headerSearch.classList.add('flex'); }

  const recBlock = document.getElementById('recommendations-container-block');
  if (recBlock) recBlock.classList.add('hidden');
  const sideBlock = document.getElementById('sidebar-container-block');
  if (sideBlock) sideBlock.classList.add('hidden');
  
  const splitContainer = document.getElementById('grid-split-container');
  if(splitContainer) splitContainer.className = "w-full space-y-8";
  
  const headerTitle = document.getElementById('grid-header-title');
  if(headerTitle) headerTitle.innerText = `Query Indexes matching: "${query}"`;
  
  const grid = document.getElementById('results-grid');
  if(grid) grid.innerHTML = "<p class='text-xs text-gray-500 font-mono animate-pulse'>Executing system scan tracking vectors...</p>";
  
  try {
    const res = await fetch(`${JIKAN_BASE}/anime?q=${encodeURIComponent(query)}&limit=16`);
    const json = await res.json();
    if(!grid) return;
    if(!json.data || json.data.length === 0) {
      grid.innerHTML = "<p class='text-xs text-gray-600 font-mono'>Zero collection nodes matched string expression parameters.</p>";
    } else {
      displayGridFeed(json.data, 'results-grid');
    }
  } catch (e) { 
    if(grid) grid.innerHTML = "<p class='text-xs text-red-400 font-mono'>Query sequence engine timeout exception.</p>"; 
  }
}

window.changeScheduleDay = function(targetDay) {
  activeScheduleDay = targetDay;
  document.querySelectorAll('.schedule-tab-btn').forEach(btn => btn.classList.remove('active', 'bg-dark-card', 'text-white'));
  const activeBtn = document.getElementById(`tab-${targetDay}`);
  if(activeBtn) activeBtn.classList.add('active', 'bg-dark-card', 'text-white');
  fetchLiveReleasingSchedule(targetDay);
}

async function fetchLiveReleasingSchedule(dayMode) {
  const scheduleBox = document.getElementById('schedule-box');
  if(!scheduleBox) return;
  scheduleBox.innerHTML = '<p class="text-[10px] text-gray-600 font-mono p-4">Syncing timeline calendar coordinates...</p>';
  
  let currentDayIndex = new Date().getDay();
  if (dayMode === 'yesterday') currentDayIndex = (currentDayIndex - 1 + 7) % 7;
  else if (dayMode === 'tomorrow') currentDayIndex = (currentDayIndex + 1) % 7;
  const targetDayString = weekdays[currentDayIndex];

  try {
    const response = await fetch(`${JIKAN_BASE}/schedules?filter=${targetDayString}&limit=15`);
    const json = await response.json();
    const rawAnimeList = json.data || [];
    const ongoingAnime = rawAnimeList.filter(anime => anime.airing === true || anime.status === "Currently Airing");
    
    if(ongoingAnime.length === 0) { 
      scheduleBox.innerHTML = `<p class="text-[11px] text-gray-600 text-center py-4 font-mono">Zero entries active on this timeline.</p>`; 
      return; 
    }
    
    scheduleBox.innerHTML = '';
    const mapCleanCache = new Map();
    ongoingAnime.forEach(anime => {
      const title = anime.title_english || anime.title;
      if(!mapCleanCache.has(title)) mapCleanCache.set(title, anime);
    });

    mapCleanCache.forEach(anime => {
      const title = anime.title_english || anime.title;
      const broadcastTime = anime.broadcast?.time || "Airing";
      const imgUrl = anime.images?.jpg?.image_url || "";
      const div = document.createElement('div');
      div.className = 'flex items-center justify-between p-2 rounded-xl bg-dark-input border border-dark-border/40 hover:border-accent/40 cursor-pointer transition-colors';
      
      const cleanTitle = title.replace(/'/g, "\\'");
      div.innerHTML = `
        <div class="min-w-0 flex-1 pr-2">
          <div class="text-[11px] font-medium text-gray-300 truncate">${title}</div>
        </div>
        <div class="text-[9px] font-mono bg-neutral-900 text-accent font-bold px-1.5 py-0.5 rounded shrink-0">JST ${broadcastTime}</div>
      `;
      div.onclick = () => window.loadStreamingLayout(anime.mal_id, cleanTitle, anime.episodes || 12, imgUrl);
      scheduleBox.appendChild(div);
    });
  } catch (error) { 
    scheduleBox.innerHTML = `<p class="text-[10px] text-red-500 font-mono p-4">Timeline mapping synchronizer fatal fault.</p>'; 
  }
}

// ==========================================
// 4. AIRING TRACK TIMELINE FUNCTIONAL MATRIX
// ==========================================
async function initCalendarTimelineLayout() {
  const daysMatrixContainer = document.getElementById('calendar-days-matrix');
  const targetList = document.getElementById('airing-chronological-list');
  
  if(daysMatrixContainer) daysMatrixContainer.innerHTML = '';
  if(targetList) targetList.innerHTML = '<p class="text-xs text-gray-500 font-mono col-span-full animate-pulse"><i class="fa-solid fa-circle-notch animate-spin mr-1"></i>Rebuilding structural grid layout coordinates...</p>';
  
  const currentDayName = weekdays[new Date().getDay()];

  if(daysMatrixContainer) {
    weekdays.forEach(day => {
      const btn = document.createElement('button');
      btn.className = `py-2 rounded-xl border border-dark-border uppercase transition-all tracking-wider ${day === currentDayName ? 'bg-accent text-black font-black' : 'bg-dark-card text-gray-400 hover:text-white'}`;
      btn.innerText = day.slice(0, 3);
      btn.id = `calendar-tab-${day}`;
      btn.onclick = () => selectCalendarTimelineDay(day);
      daysMatrixContainer.appendChild(btn);
    });
  }

  await selectCalendarTimelineDay(currentDayName);
}

async function selectCalendarTimelineDay(dayName) {
  document.querySelectorAll('[id^="calendar-tab-"]').forEach(btn => {
    btn.className = "py-2 rounded-xl border border-dark-border bg-dark-card text-gray-400 hover:text-white uppercase transition-all tracking-wider font-bold";
  });
  const activeBtn = document.getElementById(`calendar-tab-${dayName}`);
  if(activeBtn) activeBtn.className = "py-2 rounded-xl border border-accent bg-accent text-black uppercase transition-all tracking-wider font-black";

  const targetList = document.getElementById('airing-chronological-list');
  if(targetList) targetList.innerHTML = '<p class="text-xs text-gray-500 font-mono col-span-full"><i class="fa-solid fa-circle-notch animate-spin mr-1"></i>Syncing calendar row segments...</p>';
  
  try {
    const res = await fetch(`${JIKAN_BASE}/schedules?filter=${dayName}`);
    const json = await res.json();
    calendarCachedDataset = json.data || [];
    renderCalendarGridItems(calendarCachedDataset);
  } catch (err) {
    if(targetList) targetList.innerHTML = '<p class="text-xs text-red-500 font-mono col-span-full">Fail tracking chronological schedule matrix endpoints.</p>';
  }
}

function renderCalendarGridItems(dataset) {
  const targetList = document.getElementById('airing-chronological-list');
  if(!targetList) return;
  targetList.innerHTML = '';

  if(dataset.length === 0) {
    targetList.innerHTML = '<p class="text-xs text-gray-600 font-mono col-span-full">No airing targets scheduled on this interface terminal node.</p>';
    return;
  }

  dataset.forEach(anime => {
    const title = anime.title_english || anime.title;
    const imgUrl = anime.images?.jpg?.image_url || '';
    const airTime = anime.broadcast?.time || "Airing";
    const card = document.createElement('div');
    card.className = "bg-dark-card border border-dark-border rounded-2xl p-2.5 cursor-pointer hover:border-accent/40 transition-all shadow group flex flex-col justify-between";
    card.innerHTML = `
      <div>
        <div class="aspect-[2/3] w-full rounded-xl overflow-hidden bg-neutral-900 mb-2 relative">
          <img src="${imgUrl}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" alt="Cover">
          <span class="absolute bottom-2 right-2 text-[9px] font-mono font-bold bg-black/80 text-accent border border-accent/20 px-2 py-0.5 rounded backdrop-blur-sm shadow-md">JST ${airTime}</span>
        </div>
        <div class="text-xs font-semibold tracking-wide text-gray-200 truncate px-0.5 group-hover:text-white">${title}</div>
      </div>
    `;
    const cleanTitle = title.replace(/'/g, "\\'");
    card.onclick = () => window.loadStreamingLayout(anime.mal_id, cleanTitle, anime.episodes || 12, imgUrl);
    targetList.appendChild(card);
  });
}

window.filterCalendarGrid = function() {
  const searchEl = document.getElementById('calendar-search');
  if(!searchEl) return;
  const query = searchEl.value.toLowerCase().trim();
  if(!query) {
    renderCalendarGridItems(calendarCachedDataset);
    return;
  }
  const filtered = calendarCachedDataset.filter(anime => {
    const title = (anime.title_english || anime.title).toLowerCase();
    return title.includes(query);
  });
  renderCalendarGridItems(filtered);
}

window.resetCalendarGridDay = function() {
  const searchEl = document.getElementById('calendar-search');
  if(searchEl) searchEl.value = "";
  const currentDayName = weekdays[new Date().getDay()];
  selectCalendarTimelineDay(currentDayName);
}

async function fetchFullSeasonalReleases() {
  const grid = document.getElementById('releases-api-grid');
  if(!grid) return;
  grid.innerHTML = '<p class="text-xs text-gray-500 font-mono col-span-full"><i class="fa-solid fa-circle-notch animate-spin mr-1"></i>Rebuilding layout cards configuration routing grids...</p>';
  try {
    const res = await fetch(`${JIKAN_BASE}/seasons/now?limit=20`);
    const json = await res.json();
    const dataset = json.data || [];
    if(dataset.length > 0) {
      grid.innerHTML = "";
      dataset.forEach(anime => {
        const title = anime.title_english || anime.title;
        const imgUrl = anime.images?.jpg?.image_url || '';
        const card = document.createElement('div');
        card.className = "bg-dark-card border border-dark-border rounded-2xl p-2 cursor-pointer hover:border-accent/40 transition-all shadow group";
        card.innerHTML = `
          <div class="aspect-[2/3] w-full rounded-xl overflow-hidden bg-neutral-900 mb-2">
            <img src="${imgUrl}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" alt="Cover">
          </div>
          <div class="text-xs font-semibold tracking-wide text-gray-200 truncate px-1">${title}</div>
        `;
        const cleanTitle = title.replace(/'/g, "\\'");
        card.onclick = () => window.loadStreamingLayout(anime.mal_id, cleanTitle, anime.episodes || 12, imgUrl);
        grid.appendChild(card);
      });
    }
  } catch (e) { grid.innerHTML = '<p class="text-xs text-gray-600 font-mono col-span-full">Fail parsing pipeline seasonal assets streams data files.</p>'; }
}

function displayScrollFeed(animeArray, elementId) {
  const container = document.getElementById(elementId);
  if(!container) return;
  container.innerHTML = '';
  animeArray.forEach(anime => {
    const title = anime.title_english || anime.title;
    const imgUrl = anime.images?.jpg?.image_url || '';
    const card = document.createElement('div');
    card.className = "w-28 shrink-0 bg-dark-card border border-dark-border/60 p-1.5 rounded-2xl cursor-pointer hover:border-accent/40 transition-all shadow group";
    card.innerHTML = `
      <div class="aspect-[2/3] rounded-xl overflow-hidden mb-1.5 bg-neutral-900">
        <img src="${imgUrl}" class="w-full h-full object-cover" alt="Cover">
      </div>
      <div class="text-[11px] text-gray-300 font-semibold truncate px-0.5">${title}</div>
    `;
    const cleanTitle = title.replace(/'/g, "\\'");
    card.onclick = () => window.loadStreamingLayout(anime.mal_id, cleanTitle, anime.episodes || 12, imgUrl);
    container.appendChild(card);
  });
}

function displayGridFeed(animeArray, elementId) {
  const container = document.getElementById(elementId);
  if(!container) return;
  container.innerHTML = '';
  const cleanArray = animeArray || [];
  cleanArray.forEach(anime => {
    const title = anime.title_english || anime.title;
    const imgUrl = anime.images?.jpg?.image_url || '';
    const card = document.createElement('div');
    card.className = "bg-dark-card border border-dark-border/60 p-2 rounded-2xl cursor-pointer hover:border-accent/40 transition-all shadow group";
    card.innerHTML = `
      <div class="aspect-[2/3] rounded-xl overflow-hidden mb-2 bg-neutral-900">
        <img src="${imgUrl}" class="w-full h-full object-cover" alt="Cover">
      </div>
      <div class="text-xs text-gray-300 font-semibold truncate px-0.5">${title}</div>
    `;
    const cleanTitle = title.replace(/'/g, "\\'");
    card.onclick = () => window.loadStreamingLayout(anime.mal_id, cleanTitle, anime.episodes || 12, imgUrl);
    container.appendChild(card);
  });
}

function displayTop10Sidebar(animeArray) {
  const container = document.getElementById('top10-box');
  if(!container) return;
  container.innerHTML = '';
  animeArray.forEach((anime, idx) => {
    const title = anime.title_english || anime.title;
    const row = document.createElement('div');
    row.className = "flex items-center space-x-3 p-1.5 rounded-xl hover:bg-neutral-900/40 cursor-pointer transition-colors group";
    row.innerHTML = `
      <div class="text-sm font-black font-mono text-gray-600 w-4 text-center group-hover:text-accent">${idx + 1}</div>
      <div class="flex-1 min-w-0"><div class="text-xs font-medium text-gray-300 truncate">${title}</div></div>
    `;
    const cleanTitle = title.replace(/'/g, "\\'");
    row.onclick = () => window.loadStreamingLayout(anime.mal_id, cleanTitle, anime.episodes || 12, anime.images?.jpg?.image_url || "");
    container.appendChild(row);
  });
}

// ==========================================
// 5. STREAM PIPELINE & INTERACTIVE CONSOLE MODULE
// ==========================================
window.switchProvider = function(providerKey) {
  if (activeProviderKey === providerKey) return;
  activeProviderKey = providerKey;
  updateProviderTabsUI();
  
  if (window.currentMalId || window.currentAnilistId) {
    window.routeActiveStreamSource(currentEpisodeIndex);
  }
}

function updateProviderTabsUI() {
  const container = document.getElementById('server-source-tabs-bar');
  if (!container) return;

  container.innerHTML = ''; 

  const currentActiveHex = document.documentElement.style.getPropertyValue('--character-accent').trim() || '#f97316';

  API_PROVIDERS.forEach(provider => {
    const btn = document.createElement('button');
    btn.className = 'server-tab-btn whitespace-nowrap transition-all duration-200';
    btn.setAttribute('data-provider-id', provider.id);
    btn.innerHTML = `<span class="font-semibold">${provider.name}</span>`;

    if (provider.id === activeProviderKey) {
      btn.style.backgroundColor = currentActiveHex;
      btn.style.color = '#000000';
      btn.style.borderColor = currentActiveHex;
      btn.className = "px-3 py-1 text-[10px] font-black rounded-lg transition-all uppercase tracking-wider shadow-sm shrink-0 active";
    } else {
      btn.style.backgroundColor = '';
      btn.style.color = '';
      btn.style.borderColor = '';
      btn.className = "px-3 py-1 text-[10px] font-bold text-gray-500 hover:text-gray-300 rounded-lg transition-all uppercase tracking-wider bg-transparent shrink-0";
    }

    btn.onclick = () => {
      if (activeProviderKey === provider.id) return;
      window.switchProvider(provider.id);
    };

    container.appendChild(btn);
  });
}

window.loadStreamingLayout = async function(malId, titleName, totalEpisodes, imgUrl = "") {
  window.currentMalId = malId;
  window.currentAnilistId = ""; 
  window.activeAnimeTitle = titleName;
  window.activeMaxEpisodes = totalEpisodes;
  window.activeImgUrl = imgUrl || "";
  
  clearTimeout(streamLoadGuard);

  const sections = ['landing-portal', 'main-exploration-hub', 'releases-focus-view', 'calendar-focus-view'];
  sections.forEach(id => {
    const el = document.getElementById(id);
    if(el) { el.classList.add('hidden'); el.classList.remove('block', 'flex'); }
  });

  const streamBox = document.getElementById('stream-dashboard-box');
  if(streamBox) { streamBox.classList.remove('hidden'); streamBox.classList.add('block'); }
  
  const headerSearch = document.getElementById('header-search-engine');
  if(headerSearch) { headerSearch.classList.remove('hidden'); headerSearch.classList.add('flex'); }
  
  const dTitle = document.getElementById('detail-title');
  const dPoster = document.getElementById('detail-poster');
  const dEpisodes = document.getElementById('detail-episodes');
  const dType = document.getElementById('detail-type');
  const dRating = document.getElementById('detail-rating');
  const dSynopsis = document.getElementById('detail-synopsis');

  if(dTitle) dTitle.innerText = titleName;
  if(dPoster) dPoster.src = window.activeImgUrl;
  if(dEpisodes) dEpisodes.innerText = totalEpisodes;
  if(dType) dType.innerText = "TV Series";
  if(dRating) dRating.innerText = "Syncing...";
  if(dSynopsis) dSynopsis.innerText = "Requesting tracking parameters from cross-platform database...";

  updateProviderTabsUI();
  buildEpisodeIndexButtons(totalEpisodes);

  try {
    const mapRes = await fetch(`${ANIVEXA_BASE_API}/map/${malId}`);
    const mapData = await mapRes.json();
    window.currentAnilistId = mapData.anilistId || mapData.id || malId;

    const epRes = await fetch(`${ANIVEXA_BASE_API}/episodes/${window.currentAnilistId}`);
    const epData = await epRes.json();
    
    if (epData && epData.length > 0) {
      window.activeMaxEpisodes = epData.length;
      buildEpisodeIndexButtons(epData.length);
    }
  } catch(e) { 
    console.warn("Backend dynamic map mapping sequence exception fallback to base values.");
    window.currentAnilistId = malId; 
  }

  try {
    const detailRes = await fetch(`${JIKAN_BASE}/anime/${malId}`);
    const dataJson = await detailRes.json();
    const info = dataJson.data;
    if(info) {
      if(dSynopsis) dSynopsis.innerText = info.synopsis || "No data record description parameters provided.";
      if(dType) dType.innerText = info.type || "TV";
      if(dRating) dRating.innerText = info.score || "?.??";
    }
  } catch(e) { console.warn("Meta metadata sync non-fatal exception."); }

  window.routeActiveStreamSource(1);
};

function buildEpisodeIndexButtons(total) {
  const box = document.getElementById('episode-buttons');
  if(!box) return;
  box.innerHTML = '';
  for (let i = 1; i <= total; i++) {
    const btn = document.createElement('button');
    btn.id = `ep-btn-${i}`;
    btn.innerText = i < 10 ? `0${i}` : i;
    btn.className = "min-w-[40px] h-9 text-xs font-mono font-bold bg-dark-input hover:bg-neutral-800 rounded-xl border border-dark-border/60 text-gray-400 hover:text-white transition-all flex items-center justify-center";
    btn.onclick = () => window.routeActiveStreamSource(i);
    box.appendChild(btn);
  }
}

function buildMirrorStreamLinkGrids(streamData) {
  const hlsContainer = document.getElementById('internal-player-links-grid') || document.getElementById('hls-links-grid');
  const embedContainer = document.getElementById('embed-mirrors-links-grid') || document.getElementById('iframe-links-grid');
  
  if (hlsContainer) hlsContainer.innerHTML = '';
  if (embedContainer) embedContainer.innerHTML = '';

  if (hlsContainer) {
    const mainUrl = streamData.streamUrl || streamData.url;
    if (mainUrl && (mainUrl.includes('.m3u8') || streamData.type === 'hls')) {
      const btn = document.createElement('button');
      btn.className = "p-2.5 text-[11px] font-mono bg-dark-input border border-dark-border rounded-xl text-left hover:border-accent transition-colors truncate text-gray-300";
      btn.innerHTML = `<i class="fa-solid fa-play text-accent mr-1.5 text-[9px]"></i>Primary HLS Stream`;
      btn.onclick = () => {
        const wrapper = document.getElementById('video-player-wrapper');
        if(wrapper) {
          wrapper.innerHTML = `<video id="video-iframe" controls playsinline class="w-full h-full rounded-xl bg-black"></video>`;
          const videoElement = document.getElementById('video-iframe');
          initializeHlsVideo(videoElement, mainUrl);
        }
      };
      hlsContainer.appendChild(btn);
    }
  }

  const mirrors = streamData.sources || streamData.mirrors || [];
  mirrors.forEach((track, i) => {
    const linkUrl = track.url || track.link;
    if (!linkUrl) return;

    const btn = document.createElement('button');
    btn.className = "p-2.5 text-[11px] font-mono bg-dark-input border border-dark-border rounded-xl text-left hover:border-accent transition-colors truncate text-gray-300";
    
    if (linkUrl.includes('.m3u8') || track.type === 'hls' || track.type === 'm3u8') {
      btn.innerHTML = `<i class="fa-solid fa-bolt text-amber-400 mr-1.5 text-[9px]"></i>HLS Server ${i + 1}`;
      btn.onclick = () => {
        if (plyrInstance) { try { plyrInstance.destroy(); } catch(e){} plyrInstance = null; }
        const wrapper = document.getElementById('video-player-wrapper');
        if(wrapper) {
          wrapper.innerHTML = `<video id="video-iframe" controls playsinline class="w-full h-full rounded-xl bg-black"></video>`;
          const videoElement = document.getElementById('video-iframe');
          initializeHlsVideo(videoElement, linkUrl);
        }
      };
      if (hlsContainer) hlsContainer.appendChild(btn);
    } else {
      btn.innerHTML = `<i class="fa-solid fa-link text-indigo-400 mr-1.5 text-[9px]"></i>Mirror Embed ${i + 1}`;
      btn.onclick = () => {
        const wrapper = document.getElementById('video-player-wrapper');
        if (wrapper) {
          if (plyrInstance) { try { plyrInstance.destroy(); } catch(e){} plyrInstance = null; }
          wrapper.innerHTML = `<iframe id="video-iframe" src="${linkUrl}" allowfullscreen scrolling="no" class="w-full h-full bg-black rounded-xl border border-dark-border/40"></iframe>`;
        }
      };
      if (embedContainer) embedContainer.appendChild(btn);
    }
  });

  if (hlsContainer && hlsContainer.children.length === 0) {
    hlsContainer.innerHTML = `<p class="text-[10px] font-mono text-gray-600 col-span-full">No direct internal players found.</p>`;
  }
  if (embedContainer && embedContainer.children.length === 0) {
    embedContainer.innerHTML = `<p class="text-[10px] font-mono text-gray-600 col-span-full">No absolute mirror links found.</p>`;
  }
}

window.routeActiveStreamSource = async function(epIndex) {
  currentEpisodeIndex = epIndex;
  
  document.querySelectorAll('[id^="ep-btn-"]').forEach(b => {
    b.className = "min-w-[40px] h-9 text-xs font-mono font-bold bg-dark-input hover:bg-neutral-800 rounded-xl border border-dark-border/60 text-gray-400 hover:text-white transition-all flex items-center justify-center";
  });
  const targetBtn = document.getElementById(`ep-btn-${epIndex}`);
  if(targetBtn) {
    targetBtn.className = "min-w-[40px] h-9 text-xs font-mono font-black dynamic-accent-bg bg-accent text-black rounded-xl border border-accent shadow-lg flex items-center justify-center scale-105";
  }

  clearTimeout(streamLoadGuard);
  if (plyrInstance) {
    try { plyrInstance.destroy(); } catch(e){}
    plyrInstance = null;
  }

  const wrapper = document.getElementById('video-player-wrapper');
  if(!wrapper) return;
  const anilistId = window.currentAnilistId || window.currentMalId;
  let targetStreamUrl = "";

  try {
    if (activeProviderKey === 'megaplay') {
      const activeBaseUrl = PROVIDER_BASES.megaplay;
      targetStreamUrl = `${activeBaseUrl}/${window.currentMalId}/${epIndex}/${currentLanguage}`;
      wrapper.innerHTML = `<iframe id="video-iframe" src="${targetStreamUrl}" allowfullscreen scrolling="no" class="w-full h-full bg-black rounded-xl border border-dark-border/40"></iframe>`;
      buildMirrorStreamLinkGrids({ url: "", sources: [{ url: targetStreamUrl, type: "embed" }] });
      return;
    } 
    else if (activeProviderKey === 'reanime') {
      targetStreamUrl = `${ANIVEXA_BASE_API}/stream/reanime/${anilistId}/${currentLanguage}/${epIndex}`;
      wrapper.innerHTML = `<video id="video-iframe" controls playsinline class="w-full h-full rounded-xl bg-black"></video>`;
      const videoElement = document.getElementById('video-iframe');
      initializeHlsVideo(videoElement, targetStreamUrl);
      buildMirrorStreamLinkGrids({ url: targetStreamUrl, sources: [] });
    } 
    else {
      const watchResponse = await fetch(`${ANIVEXA_BASE_API}/watch/${activeProviderKey}/${anilistId}/${currentLanguage}/${activeProviderKey}-${epIndex}`);
      const streamData = await watchResponse.json();
      
      targetStreamUrl = streamData.streamUrl || streamData.url || (streamData.sources && streamData.sources[0]?.url);
      
      if (targetStreamUrl) {
        if (targetStreamUrl.includes('.m3u8') || streamData.type === 'hls' || (streamData.sources && streamData.sources[0]?.type === 'hls')) {
          wrapper.innerHTML = `<video id="video-iframe" controls playsinline class="w-full h-full rounded-xl bg-black"></video>`;
          const videoElement = document.getElementById('video-iframe');
          initializeHlsVideo(videoElement, targetStreamUrl);
        } else {
          wrapper.innerHTML = `<iframe id="video-iframe" src="${targetStreamUrl}" allowfullscreen scrolling="no" class="w-full h-full bg-black rounded-xl border border-dark-border/40"></iframe>`;
        }
        buildMirrorStreamLinkGrids(streamData);
      } else {
        throw new Error("Empty target pipeline stream source mapping index.");
      }
    }
  } catch (err) {
    console.error("Pipeline failure routing active stream node coordinates:", err);
    handleStreamMissingNotice();
  }
}

function initializeHlsVideo(videoElement, sourceUrl) {
  if (!videoElement) return;
  
  if (typeof Hls !== 'undefined' && Hls.isSupported()) {
    const hls = new Hls();
    hls.loadSource(sourceUrl);
    hls.attachMedia(videoElement);
    hls.on(Hls.Events.MANIFEST_PARSED, function() {
      if (typeof Plyr !== 'undefined') {
        plyrInstance = new Plyr(videoElement, {
          controls: ['play-large', 'play', 'progress', 'current-time', 'duration', 'mute', 'volume', 'settings', 'pip', 'fullscreen']
        });
      }
    });
    
    hls.on(Hls.Events.ERROR, function(event, data) {
      if (data.fatal) {
        handleStreamMissingNotice();
      }
    });
  } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
    videoElement.src = sourceUrl;
    if (typeof Plyr !== 'undefined') {
      plyrInstance = new Plyr(videoElement, {
        controls: ['play-large', 'play', 'progress', 'current-time', 'duration', 'mute', 'volume', 'settings', 'pip', 'fullscreen']
      });
    }
  }
}

function handleStreamMissingNotice() {
  const wrapper = document.getElementById('video-player-wrapper');
  if (!wrapper) return;
  wrapper.innerHTML = `
    <div class="w-full h-full flex flex-col justify-center items-center bg-[#111116] text-[#aaa] p-6 text-center rounded-xl border border-dark-border/40">
      <p class="text-sm font-black text-accent tracking-wider uppercase mb-1">⚠️ Video Streaming Pipeline Fault</p>
      <p class="text-[11px] text-gray-500 max-w-xs mx-auto mb-4 leading-normal">The tracking provider route "${activeProviderKey.toUpperCase()}" failed to resolve active playback links for Episode ${currentEpisodeIndex}.</p>
      <button onclick="window.switchToView('catalog')" class="dynamic-accent-bg bg-accent text-black font-bold px-5 py-2 rounded-full text-[10px] uppercase tracking-widest shadow-lg shadow-accent/20 transform active:scale-95 transition-transform">Return to Navigation Engine</button>
    </div>`;

  const hlsContainer = document.getElementById('internal-player-links-grid') || document.getElementById('hls-links-grid');
  const embedContainer = document.getElementById('embed-mirrors-links-grid') || document.getElementById('iframe-links-grid');
  if (hlsContainer) hlsContainer.innerHTML = `<p class="text-[10px] font-mono text-gray-600 col-span-full">No links available on error route.</p>`;
  if (embedContainer) embedContainer.innerHTML = `<p class="text-[10px] font-mono text-gray-600 col-span-full">No links available on error route.</p>`;
}

window.setLanguage = function(lang) {
  if (currentLanguage === lang) return;
  currentLanguage = lang;
  updateLanguageButtonsUI();
  
  if (window.currentMalId) {
    window.routeActiveStreamSource(currentEpisodeIndex);
  }
}

function updateLanguageButtonsUI() {
  const currentActiveHex = document.querySelector('.dynamic-accent-text')?.style.color || '#f97316';
  const curPreset = colorProfiles[currentPresetName] || colorProfiles.subaru;

  ['sub', 'dub'].forEach(l => {
    const btn = document.getElementById(`${l}-btn`);
    if(!btn) return;
    if (currentLanguage === l) {
      btn.style.backgroundColor = currentActiveHex;
      btn.style.color = '#ffffff'; 
      btn.style.borderColor = currentActiveHex;
      btn.className = "px-3.5 py-1 text-xs font-bold rounded-lg transition-all dynamic-accent-bg bg-accent text-black";
    } else {
      btn.style.backgroundColor = '';
      btn.style.color = '';
      btn.style.borderColor = '';
      btn.className = "px-3.5 py-1 text-xs font-bold text-gray-500 rounded-lg transition-all";
    }
  });
}

// Autoplay Event Handshake Interceptor
window.addEventListener("message", function (event) {
  let data = event.data;
  if (typeof data === "string") { try { data = JSON.parse(data); } catch (e) { return; } }
  if (data && (data.event === "complete" || data.event === "ended" || data.status === "finished")) {
    const nextEp = currentEpisodeIndex + 1;
    if (nextEp <= window.activeMaxEpisodes) {
      window.routeActiveStreamSource(nextEp);
    }
  }
});

// ==========================================
// 6. LIFE MATRIX BOOT INITIALIZER EXECUTION
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  loadSavedTheme();
  startSystemClock();
});
