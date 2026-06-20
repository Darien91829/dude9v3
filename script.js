// ==========================================
// 1. GLOBAL STATE INITIALIZATION
// ==========================================
// Replaced hardcoded string engine with a comprehensive tracking map coordinate system
const PROVIDER_BASES = {
  allmanga: "https://allmanga.buzz/stream/mal",
  megaplay: "https://megaplay.buzz/stream/mal",
  reanime: "https://reanime.buzz/stream/mal",
  anikoto: "https://anikoto.buzz/stream/mal",
  animegg: "https://animegg.buzz/stream/mal",
  animeneko: "https://animeneko.buzz/stream/mal"
};

let currentProvider = 'megaplay'; // Default initialized starting state anchor
let currentEpisodeIndex = 1;
let currentLanguage = 'sub';
let streamLoadGuard = null;

window.currentMalId = "";
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
  document.getElementById('landing-portal').style.display = 'none';
  document.getElementById('main-exploration-hub').style.display = 'none';
  document.getElementById('releases-focus-view').style.display = 'none';
  document.getElementById('calendar-focus-view').style.display = 'none';
  document.getElementById('stream-dashboard-box').style.display = 'none';
  document.getElementById('header-search-engine').style.display = 'flex';

  document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));

  const viewTitle = document.getElementById('view-indicator-title');

  if (viewTarget === 'home') {
    document.getElementById('landing-portal').style.display = 'flex';
    document.getElementById('header-search-engine').style.display = 'none';
    document.getElementById('side-nav-home').classList.add('active');
    if(viewTitle) viewTitle.innerText = "Welcome Portal";
  } else if (viewTarget === 'catalog') {
    document.getElementById('main-exploration-hub').style.display = 'block';
    document.getElementById('recommendations-container-block').style.display = 'block';
    document.getElementById('sidebar-container-block').style.display = 'block';
    document.getElementById('grid-split-container').className = "lg:col-span-2 space-y-8";
    document.getElementById('grid-header-title').innerText = "Trending Media Records";
    document.getElementById('side-nav-catalog').classList.add('active');
    if(viewTitle) viewTitle.innerText = "Catalog Exploration Matrix";
    loadMainHubFeeds();
  } else if (viewTarget === 'releases') {
    document.getElementById('releases-focus-view').style.display = 'block';
    document.getElementById('side-nav-releases').classList.add('active');
    if(viewTitle) viewTitle.innerText = "Global Release Streams";
    fetchFullSeasonalReleases();
  } else if (viewTarget === 'calendar') {
    document.getElementById('calendar-focus-view').style.display = 'block';
    document.getElementById('side-nav-calendar').classList.add('active');
    if(viewTitle) viewTitle.innerText = "Broadcasting Track Scheduler";
    initCalendarTimelineLayout();
  }
}

window.toggleMainMenu = function() {
  const drawer = document.getElementById('main-menu-drawer');
  const overlay = document.getElementById('menu-overlay');
  if (drawer.classList.contains('-translate-x-full')) {
    drawer.classList.remove('-translate-x-full');
    overlay.classList.remove('hidden');
  } else {
    drawer.classList.add('-translate-x-full');
    overlay.classList.add('hidden');
  }
}

window.homeReturnReset = function() {
  clearTimeout(streamLoadGuard);
  window.switchToView('home');
  document.getElementById('search-input').value = "";
  document.getElementById('header-search-input').value = "";
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
  document.getElementById('sheet-overlay').style.display = 'block';
  setTimeout(() => { document.getElementById('bottom-sheet-menu').classList.add('open'); }, 10);
  document.getElementById('bottom-sheet-menu').style.transform = "translateY(0)";
}

window.closeBottomSheet = function() {
  document.getElementById('bottom-sheet-menu').style.transform = "translateY(100%)";
  setTimeout(() => { document.getElementById('sheet-overlay').style.display = 'none'; }, 300);
}

window.applyCharacterPreset = function(profileKey) {
  const choice = colorProfiles[profileKey];
  if (!choice) return;
  document.documentElement.style.setProperty('--character-accent', choice.hex);
  document.documentElement.style.setProperty('--character-accent-hover', choice.hex);
  document.documentElement.style.setProperty('--character-accent-rgb', choice.rgb);
  localStorage.setItem('dude9anime-preset', profileKey);
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
    const res = await fetch("https://api.jikan.moe/v4/seasons/now?limit=22");
    const json = await res.json();
    const dataset = json.data || [];
    if(dataset.length > 0) {
      displayScrollFeed(dataset.slice(0, 10), 'recommendations-scroller');
      displayGridFeed(dataset.slice(10, 22), 'results-grid');
      displayTop10Sidebar(dataset.slice(0, 10));
    }
  } catch (err) { 
    document.getElementById('results-grid').innerHTML = "<p class='text-xs font-mono text-gray-600'>Network engine layout fallback routing triggered.</p>"; 
  }
}

window.triggerCatalogSearch = async function(fromHeader = false) {
  const queryFieldId = fromHeader ? 'header-search-input' : 'search-input';
  const query = document.getElementById(queryFieldId).value.trim();
  if(!query) return alert("Parameter target strings missing expression parameters.");

  document.getElementById('search-input').value = query;
  document.getElementById('header-search-input').value = query;

  document.getElementById('landing-portal').style.display = 'none';
  document.getElementById('stream-dashboard-box').style.display = 'none';
  document.getElementById('main-exploration-hub').style.display = 'block';
  document.getElementById('header-search-engine').style.display = 'flex';
  document.getElementById('recommendations-container-block').style.display = 'none';
  document.getElementById('sidebar-container-block').style.display = 'none';
  document.getElementById('grid-split-container').className = "w-full space-y-8";
  
  document.getElementById('grid-header-title').innerText = `Query Indexes matching: "${query}"`;
  document.getElementById('results-grid').innerHTML = "<p class='text-xs text-gray-500 font-mono animate-pulse'>Executing system scan tracking vectors...</p>";
  
  try {
    const res = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=16`);
    const json = await res.json();
    if(!json.data || json.data.length === 0) {
      document.getElementById('results-grid').innerHTML = "<p class='text-xs text-gray-600 font-mono'>Zero collection nodes matched string expression parameters.</p>";
    } else {
      displayGridFeed(json.data, 'results-grid');
    }
  } catch (e) { document.getElementById('results-grid').innerHTML = "<p class='text-xs text-red-400 font-mono'>Query sequence engine timeout exception.</p>"; }
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
  scheduleBox.innerHTML = '<p class="text-[10px] text-gray-600 font-mono p-4">Syncing timeline calendar coordinates...</p>';
  
  let currentDayIndex = new Date().getDay();
  if (dayMode === 'yesterday') currentDayIndex = (currentDayIndex - 1 + 7) % 7;
  else if (dayMode === 'tomorrow') currentDayIndex = (currentDayIndex + 1) % 7;
  const targetDayString = weekdays[currentDayIndex];

  try {
    const response = await fetch(`https://api.jikan.moe/v4/schedules?filter=${targetDayString}&limit=15`);
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
    scheduleBox.innerHTML = `<p class="text-[10px] text-red-500 font-mono p-4">Timeline mapping synchronizer fatal fault.</p>`; 
  }
}

// ==========================================
// 4. AIRING TRACK TIMELINE FUNCTIONAL MATRIX
// ==========================================
async function initCalendarTimelineLayout() {
  const daysMatrixContainer = document.getElementById('calendar-days-matrix');
  const targetList = document.getElementById('airing-chronological-list');
  
  daysMatrixContainer.innerHTML = '';
  targetList.innerHTML = '<p class="text-xs text-gray-500 font-mono col-span-full animate-pulse"><i class="fa-solid fa-circle-notch animate-spin mr-1"></i>Rebuilding structural grid layout coordinates...</p>';
  
  const currentDayName = weekdays[new Date().getDay()];

  weekdays.forEach(day => {
    const btn = document.createElement('button');
    btn.className = `py-2 rounded-xl border border-dark-border uppercase transition-all tracking-wider ${day === currentDayName ? 'bg-accent text-black font-black' : 'bg-dark-card text-gray-400 hover:text-white'}`;
    btn.innerText = day.slice(0, 3);
    btn.id = `calendar-tab-${day}`;
    btn.onclick = () => selectCalendarTimelineDay(day);
    daysMatrixContainer.appendChild(btn);
  });

  await selectCalendarTimelineDay(currentDayName);
}

async function selectCalendarTimelineDay(dayName) {
  document.querySelectorAll('[id^="calendar-tab-"]').forEach(btn => {
    btn.className = "py-2 rounded-xl border border-dark-border bg-dark-card text-gray-400 hover:text-white uppercase transition-all tracking-wider font-bold";
  });
  const activeBtn = document.getElementById(`calendar-tab-${dayName}`);
  if(activeBtn) activeBtn.className = "py-2 rounded-xl border border-accent bg-accent text-black uppercase transition-all tracking-wider font-black";

  const targetList = document.getElementById('airing-chronological-list');
  targetList.innerHTML = '<p class="text-xs text-gray-500 font-mono col-span-full"><i class="fa-solid fa-circle-notch animate-spin mr-1"></i>Syncing calendar row segments...</p>';
  
  try {
    const res = await fetch(`https://api.jikan.moe/v4/schedules?filter=${dayName}`);
    const json = await res.json();
    calendarCachedDataset = json.data || [];
    renderCalendarGridItems(calendarCachedDataset);
  } catch (err) {
    targetList.innerHTML = '<p class="text-xs text-red-500 font-mono col-span-full">Fail tracking chronological schedule matrix endpoints.</p>';
  }
}

function renderCalendarGridItems(dataset) {
  const targetList = document.getElementById('airing-chronological-list');
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
  const query = document.getElementById('calendar-search').value.toLowerCase().trim();
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
  document.getElementById('calendar-search').value = "";
  const currentDayName = weekdays[new Date().getDay()];
  selectCalendarTimelineDay(currentDayName);
}

async function fetchFullSeasonalReleases() {
  const grid = document.getElementById('releases-api-grid');
  grid.innerHTML = '<p class="text-xs text-gray-500 font-mono col-span-full"><i class="fa-solid fa-circle-notch animate-spin mr-1"></i>Rebuilding layout cards configuration routing grids...</p>';
  try {
    const res = await fetch("https://api.jikan.moe/v4/seasons/now?limit=20");
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
          <div class="aspect-[3/4] w-full rounded-xl overflow-hidden bg-neutral-900 mb-2">
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
  container.innerHTML = '';
  animeArray.forEach(anime => {
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
// Added active system switcher tool to dynamically rebind scraping endpoints
window.setScraperProvider = function(providerKey) {
  if (!PROVIDER_BASES[providerKey]) return;
  currentProvider = providerKey;
  
  // Handles active selection switching for DOM elements matching UI button maps
  document.querySelectorAll('[id^="provider-btn-"]').forEach(btn => {
    btn.className = "bg-dark-input text-gray-400 border border-dark-border px-3 py-1.5 rounded-xl text-xs font-semibold tracking-wide transition-all";
  });
  const activeBtn = document.getElementById(`provider-btn-${providerKey}`);
  if (activeBtn) {
    activeBtn.className = "dynamic-accent-bg bg-accent text-black border border-accent font-black px-3 py-1.5 rounded-xl text-xs tracking-wide shadow-md";
  }

  // Forces instantaneous player execution reload if mid-session content routing exists
  if (window.currentMalId) {
    launchVideoPlayer(currentEpisodeIndex);
  }
}

window.loadStreamingLayout = async function(malId, titleName, totalEpisodes, imgUrl = "") {
  window.currentMalId = malId;
  window.activeAnimeTitle = titleName;
  window.activeMaxEpisodes = totalEpisodes;
  window.activeImgUrl = imgUrl || "https://images.alphacoders.com/134/1344238.png";
  
  clearTimeout(streamLoadGuard);

  document.getElementById('landing-portal').style.display = 'none';
  document.getElementById('main-exploration-hub').style.display = 'none';
  document.getElementById('releases-focus-view').style.display = 'none';
  document.getElementById('calendar-focus-view').style.display = 'none';
  document.getElementById('stream-dashboard-box').style.display = 'block';
  document.getElementById('header-search-engine').style.display = 'flex';

  // Fallback checks for missing titles or headings inside stream layouts
  const titleEl = document.getElementById('ep-title');
  if (titleEl) titleEl.innerText = `Watching: ${titleName}`;
  
  document.getElementById('detail-title').innerText = titleName;
  document.getElementById('detail-poster').src = window.activeImgUrl;
  document.getElementById('detail-episodes').innerText = totalEpisodes;

  document.getElementById('detail-type').innerText = "TV Series";
  document.getElementById('detail-rating').innerText = "Syncing...";
  document.getElementById('detail-synopsis').innerText = "Requesting Jikan API documentation files database metrics...";

  const epBox = document.getElementById('episode-buttons');
  epBox.innerHTML = '';
  for (let i = 1; i <= totalEpisodes; i++) {
    const btn = document.createElement('button');
    btn.className = "bg-dark-input hover:bg-neutral-900 border border-dark-border text-gray-400 font-bold px-3 py-1.5 rounded-lg text-xs min-w-[36px] tracking-wide transition-all ep-btn shadow-sm";
    btn.id = `ep-choice-${i}`;
    btn.innerText = `${i}`;
    btn.onclick = () => launchVideoPlayer(i);
    epBox.appendChild(btn);
  }

  try {
    const detailRes = await fetch(`https://api.jikan.moe/v4/anime/${malId}`);
    const dataJson = await detailRes.json();
    const info = dataJson.data;
    if(info) {
      document.getElementById('detail-synopsis').innerText = info.synopsis || "No meta documentation registered.";
      document.getElementById('detail-type').innerText = info.type || "TV";
      document.getElementById('detail-rating').innerText = info.score || "N/A";
    }
  } catch(e) { console.warn("Meta metadata folder route fail mapping parameters."); }

  // Sync state parameters to lock correct default focus visual layouts
  window.setScraperProvider(currentProvider);
};

function launchVideoPlayer(epNum) {
  currentEpisodeIndex = epNum;
  document.querySelectorAll('.ep-btn').forEach(b => {
    b.className = "bg-dark-input hover:bg-neutral-900 border border-dark-border text-gray-400 font-bold px-3 py-1.5 rounded-lg text-xs min-w-[36px] tracking-wide transition-all ep-btn shadow-sm";
  });
  const activeBtn = document.getElementById(`ep-choice-${epNum}`);
  if (activeBtn) {
    activeBtn.className = "dynamic-accent-bg bg-accent text-black border border-accent font-black px-3 py-1.5 rounded-lg text-xs min-w-[36px] tracking-wide transition-all ep-btn shadow-md shadow-accent/10";
  }
  
  const playerBox = document.getElementById('player-box');
  if (!playerBox) return;
  
  playerBox.innerHTML = '<iframe id="video-iframe" src="" allowfullscreen scrolling="no" class="w-full h-full bg-black rounded-xl border border-dark-border/40"></iframe>';
  const iframe = document.getElementById('video-iframe');
  
  // Appends base target endpoints out of current active provider mapping variables dynamically
  const activeBaseUrl = PROVIDER_BASES[currentProvider] || PROVIDER_BASES.megaplay;
  iframe.src = `${activeBaseUrl}/${window.currentMalId}/${epNum}/${currentLanguage}`;
  
  clearTimeout(streamLoadGuard);
  streamLoadGuard = setTimeout(() => handleStreamMissingNotice(), 8000);
}

function handleStreamMissingNotice() {
  const playerBox = document.getElementById('player-box');
  if (!playerBox) return;
  playerBox.innerHTML = `
    <div class="w-full h-full flex flex-col justify-center items-center bg-[#111116] color-[#aaa] p-6 text-center rounded-xl border border-dark-border/40">
      <p class="text-sm font-black text-accent tracking-wider uppercase mb-1">⚠️ Video Streaming Mirror Unavailable</p>
      <p class="text-[11px] text-gray-500 max-w-xs mx-auto mb-4 leading-normal">The requested stream tracker "${currentProvider.toUpperCase()}" could not parse structural folder routes mapping for this episodic file tracking stream block.</p>
      <button onclick="window.switchToView('catalog')" class="dynamic-accent-bg bg-accent text-black font-bold px-5 py-2 rounded-full text-[10px] uppercase tracking-widest shadow-lg shadow-accent/20 transform active:scale-95 transition-transform">Return to Navigation Engine</button>
    </div>`;
}

window.setLanguage = function(lang) {
  currentLanguage = lang;
  const subBtn = document.getElementById('sub-btn');
  const dubBtn = document.getElementById('dub-btn');
  
  if(lang === 'sub') {
    subBtn.className = "lang-btn active px-3.5 py-1 text-xs font-bold rounded-lg transition-all text-gray-400 hover:text-white";
    dubBtn.className = "lang-btn px-3.5 py-1 text-xs font-bold rounded-lg transition-all text-gray-400 hover:text-white";
  } else {
    subBtn.className = "lang-btn px-3.5 py-1 text-xs font-bold rounded-lg transition-all text-gray-400 hover:text-white";
    dubBtn.className = "lang-btn active px-3.5 py-1 text-xs font-bold rounded-lg transition-all text-gray-400 hover:text-white";
  }
  launchVideoPlayer(currentEpisodeIndex);
}

window.addEventListener("message", function (event) {
  let data = event.data;
  if (typeof data === "string") { try { data = JSON.parse(data); } catch (e) { return; } }
  if (data && (data.event === "playing" || data.event === "ready")) {
    clearTimeout(streamLoadGuard);
  }
  if (data && data.event === "error") {
    clearTimeout(streamLoadGuard);
    handleStreamMissingNotice();
  }
});

// ==========================================
// 6. LIFE MATRIX BOOT INITIALIZER EXECUTION
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  loadSavedTheme();
  startSystemClock();
});
