// ==========================================================================
// FULLY REWRITTEN & OPTIMIZED SCRIPT.JS WITH ADVANCED MEGAPLAY PATCH
// ==========================================================================

const JIKAN_BASE = "https://api.jikan.moe/v4";

// YOUR STANDALONE STREAMING API HOSTED ON VERCEL
const ANIVEXA_BASE_API = "https://anivexa-api-eta.vercel.app";
const MEGAPLAY_PLAYER_BASE = "https://megaplay.buzz/stream/mal";

let currentEpisodeIndex = 1;
let currentLanguage = 'sub';
let activeScheduleDay = 'today';
let activeProviderMode = 'allmanga'; // Default active provider

// Track all available backend providers from your API manifest (Including MegaPlay)
const API_PROVIDERS = [
  { id: 'allmanga', name: 'AllManga', status: 'Active' },
  { id: 'megaplay', name: 'MegaPlay', status: 'Active' },
  { id: 'reanime', name: 'ReAnime', status: 'Active' },
  { id: 'anikoto', name: 'AniKoto', status: 'Active' },
  { id: 'animegg', name: 'AnimeGG', status: 'Active' },
  { id: 'anineko', name: 'AniNeko', status: 'Active' },
  { id: 'anidbapp', name: 'AniDB App', status: 'Active' },
  { id: 'animepahe', name: 'AnimePahe', status: 'Unstable' }
];

// Local Mock Fallback Data Structure to keep UI operational if API is down
const MOCK_OFFLINE_EPISODES_PAYLOAD = [
  {
    provider: "allmanga",
    episodes: [ 
      { number: 1, id: "mock-ep-1", title: "Episode 1 (Offline Server Mirror)" },
      { number: 2, id: "mock-ep-2", title: "Episode 2 (Offline Server Mirror)" },
      { number: 3, id: "mock-ep-3", title: "Episode 3 (Offline Server Mirror)" },
      { number: 4, id: "mock-ep-4", title: "Episode 4 (Offline Server Mirror)" },
      { number: 5, id: "mock-ep-5", title: "Episode 5 (Offline Server Mirror)" },
      { number: 6, id: "mock-ep-6", title: "Episode 6 (Offline Server Mirror)" },
      { number: 7, id: "mock-ep-7", title: "Episode 7 (Offline Server Mirror)" },
      { number: 8, id: "mock-ep-8", title: "Episode 8 (Offline Server Mirror)" },
      { number: 9, id: "mock-ep-9", title: "Episode 9 (Offline Server Mirror)" },
      { number: 10, id: "mock-ep-10", title: "Episode 10 (Offline Server Mirror)" },
      { number: 11, id: "mock-ep-11", title: "Episode 11 (Offline Server Mirror)" },
      { number: 12, id: "mock-ep-12", title: "Episode 12 (Offline Server Mirror)" }
    ]
  }
];

// Sample public working HLS stream URL to prevent visual playback errors when offline
const MOCK_FALLBACK_STREAM_URL = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";

// Guard items to stop loop updates on view toggle
let hubFeedsLoaded = false;
let recentReleasesLoaded = false;
let calendarLoaded = false;
let currentPresetName = 'subaru';
let selectedDayFilter = '';

// Store the fetched server episode mapping objects globally so we can access real API data IDs
let globalEpisodeDataCache = null;
let globalJikanEpisodeCount = null; // Caches real MAL episode count to fully wipe hardcoded caps

window.currentAnilistId = null;
window.currentMalId = null;
window.activeAnimeTitle = "";
window.activeMaxEpisodes = 12;

// Store global hls.js and Plyr references to safely destroy them
window.currentHlsInstance = null;
window.currentPlyr = null;
window.streamLoadGuard = null;

const presets = {
  subaru: { hex: 'rgb(0, 255, 102)', bg: '#050505', card: '#111111', input: '#1a1a1e', textLight: true, rgb: '0, 255, 102' },
  emilia: { hex: '#c084fc', bg: '#0d0a12', card: '#14101c', input: '#1e182a', textLight: true, rgb: '192, 132, 252' },
  rem: { hex: '#38bdf8', bg: '#090e14', card: '#101620', input: '#182230', textLight: false, rgb: '56, 189, 248' },
  ram: { hex: '#fb7185', bg: '#140c0e', card: '#201317', input: '#2d1b20', textLight: false, rgb: '251, 113, 133' },
  beatrice: { hex: '#fbbf24', bg: '#14110c', card: '#201a12', input: '#2d251a', textLight: false, rgb: '251, 191, 36' },
  felt: { hex: '#eab308', bg: '#12110a', card: '#1c1a10', input: '#2a2718', textLight: false, rgb: '234, 179, 8' },
  reinhard: { hex: '#dc2626', bg: '#140b0b', card: '#201111', input: '#2e1919', textLight: true, rgb: '220, 38, 38' },
  crusch: { hex: '#059669', bg: '#0a120e', card: '#101c16', input: '#182b22', textLight: true, rgb: '5, 150, 105' },
  felix: { hex: '#d97706', bg: '#140b0b', card: '#201911', input: '#2e2419', textLight: false, rgb: '217, 119, 6' },
  priscilla: { hex: '#ef4444', bg: '#120a0a', card: '#1c1010', input: '#2a1818', textLight: true, rgb: '239, 68, 68' },
  anastasia: { hex: '#f472b6', bg: '#140d11', card: '#20141b', input: '#2e1d27', textLight: false, rgb: '244, 114, 182' },
  julius: { hex: '#818cf8', bg: '#0d0d14', card: '#141420', input: '#1e1e2e', textLight: true, rgb: '129, 140, 248' },
  wilhelm: { hex: '#94a3b8', bg: '#0f1115', card: '#171a21', input: '#222630', textLight: false, rgb: '148, 163, 184' },
  roswaal: { hex: '#4f46e5', bg: '#0b0a14', card: '#111020', input: '#19182e', textLight: true, rgb: '79, 70, 229' },
  satella: { hex: '#6d28d9', bg: '#0a0812', card: '#100c1c', input: '#18122b', textLight: true, rgb: '109, 40, 217' },
  echidna: { hex: '#e4e4e7', bg: '#101012', card: '#18181c', input: '#24242a', textLight: false, rgb: '228, 228, 231' }
};

const delay = ms => new Promise(res => setTimeout(res, ms));

async function fetchWithRetry(url, options = {}, retries = 2) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return await response.json();
      if (response.status === 429) throw new Error("Rate limited");
    } catch (err) {
      if (i === retries - 1) throw err;
      await delay(1000 * (i + 1)); 
    }
  }
}

function applyCharacterPreset(name) {
  const p = presets[name]; if (!p) return;
  currentPresetName = name;
  document.body.style.backgroundColor = p.bg;
  document.querySelectorAll('.sidebar').forEach(el => el.style.backgroundColor = p.bg);
  document.querySelectorAll('.bg-dark-card').forEach(el => el.style.backgroundColor = p.card);
  document.querySelectorAll('.bg-dark-input').forEach(el => el.style.backgroundColor = p.input);
  document.querySelectorAll('.border-dark').forEach(el => el.style.borderColor = p.input);
  
  // Dynamic design variables initialization
  document.documentElement.style.setProperty('--character-accent', p.hex);
  document.documentElement.style.setProperty('--character-accent-rgb', p.rgb);
  document.documentElement.style.setProperty('--preset-text-color', p.textLight ? '#ffffff' : '#000000');

  document.querySelectorAll('.dynamic-accent-text').forEach(el => el.style.color = p.hex);
  document.querySelectorAll('.dynamic-accent-bg').forEach(el => {
    el.style.backgroundColor = p.hex; el.style.color = p.textLight ? '#ffffff' : '#000000';
  });
  updateProviderButtonsUI();
  updateLanguageButtonsUI();
  if (window.currentAnilistId) updateEpisodeButtonsUI();
  
  // Clean tab updates mapping directly to active layout selections
  ['yesterday', 'today', 'tomorrow'].forEach(day => {
    const b = document.getElementById(`tab-${day}`);
    if (b) {
      if (day === activeScheduleDay) {
        b.style.backgroundColor = p.hex;
        b.style.color = p.textLight ? '#ffffff' : '#000000';
      } else {
        b.style.backgroundColor = 'transparent';
        b.style.color = '#6b7280';
      }
    }
  });

  document.querySelectorAll('.consumet-card-item').forEach(card => {
    card.addEventListener('mouseenter', () => card.style.borderColor = `${p.hex}4d`);
    card.addEventListener('mouseleave', () => card.style.borderColor = 'transparent');
  });
  renderCalendarGridStructure();
  
  if (window.currentPlyr) {
    document.documentElement.style.setProperty('--plyr-color-main', p.hex);
  }
}

function initCalendarUI() {
  setupCalendarControls();
  renderCalendarGridStructure();
  fetchAndRenderChronologicalList();
}

function setupCalendarControls() {
  const todayBtn = document.getElementById('jump-today-btn');
  const searchInput = document.getElementById('calendar-search');

  if (todayBtn && !todayBtn.dataset.bound) {
    todayBtn.dataset.bound = true;
    todayBtn.addEventListener('click', () => {
      selectedDayFilter = '';
      if(searchInput) searchInput.value = '';
      renderCalendarGridStructure();
      fetchAndRenderChronologicalList();
    });
  }
  if (searchInput && !searchInput.dataset.bound) {
    searchInput.dataset.bound = true;
    searchInput.addEventListener('input', () => {
      fetchAndRenderChronologicalList(searchInput.value.trim());
    });
  }
}

function renderCalendarGridStructure() {
  const matrixContainer = document.getElementById('calendar-days-matrix');
  if (!matrixContainer) return;
  matrixContainer.innerHTML = '';

  const todayDayIndex = new Date().getDay(); 
  const daysFull = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const daysShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const currentAccentColor = document.querySelector('.dynamic-accent-text')?.style.color || 'rgb(0, 255, 102)';
  
  for (let i = 0; i < 7; i++) {
    const dayBox = document.createElement('button');
    dayBox.className = "calendar-matrix-day bg-[#111111] border border-[#1c1c1e] rounded-xl py-3 px-1 flex flex-col items-center justify-center text-[11px] font-bold text-gray-400 transition-all select-none hover:border-gray-600";
    
    dayBox.innerHTML = `
      <span class="text-[9px] text-gray-500 uppercase tracking-tight mb-0.5">${daysShort[i].slice(0,2)}</span>
      <span>${daysShort[i]}</span>
    `;
    
    if (selectedDayFilter === daysFull[i]) {
      dayBox.classList.add('selected-filter');
      dayBox.style.backgroundColor = currentAccentColor;
      dayBox.style.borderColor = currentAccentColor;
      dayBox.style.color = '#000000';
    } else if (i === todayDayIndex && !selectedDayFilter) {
      dayBox.classList.add('active-today');
      dayBox.style.borderColor = currentAccentColor;
      dayBox.style.color = '#ffffff';
    }

    dayBox.onclick = () => {
      if (selectedDayFilter === daysFull[i]) {
        selectedDayFilter = ''; 
      } else {
        selectedDayFilter = daysFull[i];
      }
      renderCalendarGridStructure();
      const searchInput = document.getElementById('calendar-search');
      fetchAndRenderChronologicalList(searchInput ? searchInput.value.trim() : "");
    };

    matrixContainer.appendChild(dayBox);
  }
}

async function fetchAndRenderChronologicalList(filterTerm = "") {
  const listContainer = document.getElementById('airing-chronological-list');
  if (!listContainer) return;

  listContainer.innerHTML = `
    <div class="text-center py-8 text-xs text-gray-500">
      <i class="fa-solid fa-circle-notch animate-spin text-sm mr-2 text-emerald-500 dynamic-accent-text"></i> Syncing AniList broadcast tracks...
    </div>
  `;

  const targetTime = new Date();
  const currentDayIndex = targetTime.getDay();
  
  const startOfWeek = new Date(targetTime);
  startOfWeek.setDate(targetTime.getDate() - currentDayIndex);
  startOfWeek.setHours(0, 0, 0, 0);
  
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  const startTimeSeconds = Math.floor(startOfWeek.getTime() / 1000);
  const endTimeSeconds = Math.floor(endOfWeek.getTime() / 1000);

  const calendarGraphQLQuery = `
    query ($start: Int, $end: Int) {
      Page(page: 1, perPage: 100) {
        airingSchedules(airingAt_greater: $start, airingAt_lesser: $end, sort: TIME_ASC) {
          episode
          airingAt
          media {
            id
            idMal
            type
            averageScore
            title {
              english
              romaji
            }
            coverImage {
              large
            }
            episodes
          }
        }
      }
    }`;

  try {
    const response = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: calendarGraphQLQuery,
        variables: { start: startTimeSeconds, end: endTimeSeconds }
      })
    });
    
    const json = await response.json();
    const rawSchedules = json.data?.Page?.airingSchedules || [];

    if (rawSchedules.length === 0) {
      listContainer.innerHTML = `<div class="text-xs text-gray-500 py-4 text-center">No scheduled items found.</div>`;
      return;
    }

    const daysOfWeek = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const todayName = daysOfWeek[new Date().getDay()];
    listContainer.innerHTML = '';

    const mappedDays = {};
    daysOfWeek.forEach(d => mappedDays[d] = []);

    rawSchedules.forEach(item => {
      if (!item.media) return;
      const airDate = new Date(item.airingAt * 1000);
      const localDayLabel = daysOfWeek[airDate.getDay()];
      
      const title = item.media.title.english || item.media.title.romaji || "";
      if (filterTerm && !title.toLowerCase().includes(filterTerm.toLowerCase())) return;

      mappedDays[localDayLabel].push(item);
    });

    daysOfWeek.forEach(dayLabel => {
      if (selectedDayFilter && dayLabel !== selectedDayFilter) return;

      const animeList = mappedDays[dayLabel];
      if (animeList.length === 0) return;

      const daySection = document.createElement('div');
      daySection.className = "mb-6";

      let displayDayLabel = dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1);
      if (dayLabel === todayName) {
        displayDayLabel = `${displayDayLabel} &bull; Today`;
      }

      let listHtml = `
        <div class="flex items-center justify-between border-b border-zinc-800 pb-2 mb-3">
          <h3 class="text-xs font-bold text-gray-300 uppercase tracking-wider">${displayDayLabel}</h3>
          <span class="text-[10px] text-gray-500 font-medium font-mono">${animeList.length} titles</span>
        </div>
        <div class="space-y-2">
      `;

      animeList.forEach(item => {
        const anime = item.media;
        const title = anime.title.english || anime.title.romaji;
        const airDate = new Date(item.airingAt * 1000);
        const airTime = airDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        const scoreDisplay = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : 'N/A';

        listHtml += `
          <div onclick="switchToView('catalog'); loadStreamingLayout(${anime.id}, ${anime.idMal || 'null'}, '${title.replace(/'/g, "\\\\'")}')"
               class="flex items-center justify-between p-2 rounded-xl bg-transparent hover:bg-neutral-900/40 cursor-pointer transition-all group">
            <div class="flex items-center gap-3 min-w-0">
              <img src="${anime.coverImage?.large}" class="w-10 h-10 object-cover rounded-lg shrink-0 border border-zinc-800">
              <div class="min-w-0">
                <h4 class="text-xs font-semibold text-gray-200 group-hover:text-white transition-colors truncate">${title}</h4>
                <p class="text-[10px] text-gray-500 mt-0.5 font-mono">${anime.type || 'TV'} &bull; Ep ${item.episode} &bull; Score: ${scoreDisplay}</p>
              </div>
            </div>
            <span class="text-[10px] font-mono font-bold text-gray-400 shrink-0 bg-zinc-900/80 px-2 py-1 rounded border border-zinc-800">${airTime}</span>
          </div>
        `;
      });

      listHtml += `</div>`;
      daySection.innerHTML = listHtml;
      listContainer.appendChild(daySection);
    });

    if (listContainer.innerHTML === '') {
      listContainer.innerHTML = `<div class="text-xs text-gray-500 py-4 text-center">No matching upcoming series airing for this choice.</div>`;
    }

  } catch (err) {
    console.error(err);
    listContainer.innerHTML = `
      <div class="text-center py-6">
        <p class="text-xs text-red-500 mb-3">AniList data hub temporary standby.</p>
        <button onclick="fetchAndRenderChronologicalList()" class="bg-emerald-500 text-black px-4 py-1.5 rounded-full text-xs font-bold transition-transform active:scale-95">Retry Connection</button>
      </div>`;
  }
}

function toggleMainMenu() {
  const drawer = document.getElementById('main-menu-drawer');
  const overlay = document.getElementById('menu-overlay');
  if (!drawer || !overlay) return;
  if (drawer.classList.contains('-translate-x-full')) {
    drawer.classList.remove('-translate-x-full');
    overlay.classList.remove('hidden');
  } else {
    drawer.classList.add('-translate-x-full');
    overlay.classList.add('hidden');
  }
}

async function loadRecentReleases() {
  const targetGrid = document.getElementById("releases-api-grid");
  if (!targetGrid) return;

  try {
    const json = await fetchWithRetry(`${JIKAN_BASE}/seasons/now?limit=20`);
    targetGrid.innerHTML = "";

    if (!json.data || json.data.length === 0) {
      targetGrid.innerHTML = `<p class="text-xs text-gray-500 col-span-full text-center py-6">No seasonal episodes found from Jikan catalog tracks.</p>`;
      return;
    }

    json.data.forEach(anime => {
      const cardFrame = document.createElement("div");
      cardFrame.className = "consumet-card-item relative group aspect-[2/3] w-full rounded-2xl overflow-hidden bg-zinc-900 border border-transparent shadow-xl cursor-pointer transition-all duration-300 hover:scale-[1.02]";
      
      cardFrame.innerHTML = `
        <img src="${anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url}" alt="${anime.title}" class="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
        <div class="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent"></div>
        <div class="absolute inset-x-0 bottom-0 p-3 sm:p-4 flex flex-col gap-1.5 justify-end h-1/2">
          <h3 class="consumet-card-title text-white font-medium text-xs sm:text-sm line-clamp-2 leading-tight drop-shadow-md transition-colors duration-200">
            ${anime.title_english || anime.title}
          </h3>
          <div class="flex items-center gap-2 text-[10px] font-medium mt-0.5">
            <span class="bg-zinc-950/90 text-zinc-200 px-2 py-0.5 rounded border border-zinc-800/60 font-mono tracking-wide">
              EP ${anime.episodes || 'Airing'}
            </span>
            <span class="uppercase text-[9px] tracking-wider bg-neutral-900/80 text-gray-300 px-1.5 py-0.5 rounded border border-zinc-800/40 font-bold">
              ${anime.type || 'TV'}
            </span>
          </div>
        </div>
      `;

      cardFrame.addEventListener('mouseenter', () => {
        const currentHex = document.querySelector('.dynamic-accent-text')?.style.color || 'rgb(0, 255, 102)';
        cardFrame.style.borderColor = `${currentHex}4d`;
        const cTitle = cardFrame.querySelector('.consumet-card-title');
        if (cTitle) cTitle.style.color = currentHex;
      });
      cardFrame.addEventListener('mouseleave', () => {
        cardFrame.style.borderColor = 'transparent';
        const cTitle = cardFrame.querySelector('.consumet-card-title');
        if (cTitle) cTitle.style.color = '#ffffff';
      });

      cardFrame.addEventListener("click", async () => {
        let mappedId = anime.mal_id;
        try {
          const lookup = await fetch(`https://graphql.anilist.co`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: `query($id: Int) { Media(idMal: $id, type: ANIME) { id } }`,
              variables: { id: anime.mal_id }
            })
          });
          const res = await lookup.json();
          mappedId = res?.data?.Media?.id || anime.mal_id;
        } catch(e){}
        loadStreamingLayout(mappedId, anime.mal_id, anime.title_english || anime.title);
      });

      targetGrid.appendChild(cardFrame);
    });

  } catch (error) {
    console.error("Jikan payload error:", error);
    targetGrid.innerHTML = `
      <div class="col-span-full py-8 text-center">
        <p class="text-xs text-red-500 mb-3">Server temporarily busy.</p>
        <button onclick="loadRecentReleases()" class="bg-emerald-500 text-black px-4 py-1.5 rounded-full text-xs font-bold transition-transform active:scale-95">Retry Connection</button>
      </div>`;
  }
}

function switchToView(targetViewId) {
  const views = ['landing-portal', 'main-exploration-hub', 'releases-focus-view', 'calendar-focus-view', 'stream-dashboard-box'];
  views.forEach(v => {
    const el = document.getElementById(v);
    if (el) el.classList.add('hidden');
  });
  
  const sideItems = ['home', 'catalog', 'releases', 'calendar'];
  sideItems.forEach(item => {
    const el = document.getElementById(`side-nav-${item}`);
    if (el) el.classList.remove('active');
  });

  const indicator = document.getElementById('view-indicator-title');
  
  if (targetViewId === 'home') {
    document.getElementById('landing-portal')?.classList.remove('hidden');
    document.getElementById('header-search-engine')?.classList.add('hidden');
    document.getElementById('side-nav-home')?.classList.add('active');
    if (indicator) indicator.innerText = "Welcome Portal";
  } else if (targetViewId === 'catalog') {
    document.getElementById('main-exploration-hub')?.classList.remove('hidden');
    document.getElementById('header-search-engine')?.classList.remove('hidden');
    document.getElementById('side-nav-catalog')?.classList.add('active');
    if (indicator) indicator.innerText = "Catalog Index Browser";
    
    if (!hubFeedsLoaded) {
      hubFeedsLoaded = true;
      loadMainHubFeeds();
    }
  } else if (targetViewId === 'releases') {
    document.getElementById('releases-focus-view')?.classList.remove('hidden');
    document.getElementById('header-search-engine')?.classList.remove('hidden');
    document.getElementById('side-nav-releases')?.classList.add('active');
    if (indicator) indicator.innerText = "Recent Time Releases Feed";
    
    if (!recentReleasesLoaded) {
      recentReleasesLoaded = true;
      loadRecentReleases(); 
    }
  } else if (targetViewId === 'calendar') {
    document.getElementById('calendar-focus-view')?.classList.remove('hidden');
    document.getElementById('header-search-engine')?.classList.add('hidden'); 
    document.getElementById('side-nav-calendar')?.classList.add('active');
    if (indicator) indicator.innerText = "Airing Schedule";
    
    if (!calendarLoaded) {
      calendarLoaded = true;
      initCalendarUI(); 
    }
  }
}

function startSystemClock() {
  setInterval(() => {
    const now = new Date();
    const jstString = now.toLocaleTimeString("en-US", {
      timeZone: "Asia/Tokyo", hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit"
    });
    const clockEl = document.getElementById('live-24h-clock');
    if (clockEl) clockEl.innerText = `${jstString} JST`;
  }, 1000);
}

function openBottomSheet() {
  document.getElementById('sheet-overlay')?.classList.remove('hidden');
  document.getElementById('bottom-sheet-menu')?.classList.remove('translate-y-full');
}

function closeBottomSheet() {
  document.getElementById('sheet-overlay')?.classList.add('hidden');
  document.getElementById('bottom-sheet-menu')?.classList.add('translate-y-full');
}

function homeReturnReset() {
  switchToView('home');
  if(document.getElementById('search-input')) document.getElementById('search-input').value = "";
  if(document.getElementById('header-search-input')) document.getElementById('header-search-input').value = "";
}

async function loadMainHubFeeds() {
  changeScheduleDay(activeScheduleDay);
  await delay(600);

  try {
    const json = await fetchWithRetry(`${JIKAN_BASE}/top/anime?limit=12`);
    const dataset = json.data;
    if(Array.isArray(dataset) && dataset.length > 0) {
      displayScrollFeed(dataset, 'recommendations-scroller');
    } else {
      handleAnikotoScrollerEmpty();
    }
  } catch (err) {
    handleAnikotoScrollerEmpty();
  }
    
  try {
    const aniListQuery = `query { Page(page: 1, perPage: 12) { media(sort: TRENDING_DESC, type: ANIME) { id idMal title { english romaji } coverImage { large } episodes } } }`;
    const graphRes = await fetch('https://graphql.anilist.co', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: aniListQuery })
    });
    const graphJson = await graphRes.json();
    const trendingItems = graphJson.data?.Page?.media || [];
    if(trendingItems.length > 0) {
      displayGridFeed(trendingItems, 'results-grid');
      displayTop10Sidebar(trendingItems);
    } else {
      document.getElementById('results-grid').innerHTML = "<p class='text-xs text-gray-500'>No trending items returned from server.</p>";
    }
  } catch (err) {
    document.getElementById('results-grid').innerHTML = "<p class='text-xs text-gray-500'>Error loading layout catalog channels.</p>";
  }
}

function handleAnikotoScrollerEmpty() {
  const scroller = document.getElementById('recommendations-scroller');
  if (scroller) scroller.innerHTML = "<p class='text-xs text-gray-600 italic'>Scroller engine offline. Use core catalog below.</p>";
}

async function triggerCatalogSearch(fromHeader = false) {
  const queryFieldId = fromHeader ? 'header-search-input' : 'search-input';
  const queryInputEl = document.getElementById(queryFieldId);
  const query = queryInputEl ? queryInputEl.value.trim() : "";
  
  if(document.getElementById('search-input')) document.getElementById('search-input').value = query;
  if(document.getElementById('header-search-input')) document.getElementById('header-search-input').value = query;

  switchToView('catalog');

  const gridHeader = document.getElementById('grid-header-title');
  if (gridHeader) gridHeader.innerText = query ? `Catalog Matches: "${query}"` : "Trending Global Media Items";
  
  const gridResults = document.getElementById('results-grid');
  if (gridResults) gridResults.innerHTML = "<p class='text-xs text-gray-500'>Querying database links...</p>";
  
  let variables = {};
  if (query !== "") {
    variables.q = query;
  } else {
    variables.sort = ["TRENDING_DESC"];
  }

  const aniListSearchQuery = `
    query ($q: String, $sort: [MediaSort]) {
      Page(page: 1, perPage: 24) {
        media(search: $q, sort: $sort, type: ANIME) {
          id
          idMal
          title { english romaji }
          coverImage { large }
          episodes
        }
      }
    }`;

  try {
    const graphRes = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: aniListSearchQuery, variables: variables })
    });
    const json = await graphRes.json();
    const fontItems = json.data?.Page?.media || [];
    
    if (gridResults) {
      if(fontItems.length === 0) {
        gridResults.innerHTML = "<p class='text-xs text-gray-500'>No anime matches found.</p>";
      } else {
        displayGridFeed(fontItems, 'results-grid');
      }
    }
  } catch (e) {
    console.error(e);
    if (gridResults) gridResults.innerHTML = "<p class='text-xs text-gray-500'>API communications error.</p>";
  }
}

function changeScheduleDay(targetDay) {
  activeScheduleDay = targetDay;
  
  // Re-run preset assignment immediately to update navigation style classes cleanly
  applyCharacterPreset(currentPresetName);
  fetchLiveReleasingSchedule(targetDay);
}

async function fetchLiveReleasingSchedule(dayMode) {
  const scheduleBox = document.getElementById('schedule-box');
  if(!scheduleBox) return;
  scheduleBox.innerHTML = '<p class="text-gray-500 text-[11px] p-2"><i class="fa-solid fa-circle-notch animate-spin mr-1"></i>Updating timeline...</p>';
  
  const nowJst = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Tokyo"}));
  const dayOffsetMap = { 'yesterday': -1, 'today': 0, 'tomorrow': 1 };
  nowJst.setDate(nowJst.getDate() + dayOffsetMap[dayMode]);
  nowJst.setHours(0,0,0,0);
  
  const startTimestamp = Math.floor(nowJst.getTime() / 1000);
  const endTimestamp = startTimestamp + 86400;

  const scheduleQuery = `
    query ($start: Int, $end: Int) { 
      Page(page: 1, perPage: 25) { 
        airingSchedules(airingAt_greater: $start, airingAt_lesser: $end, sort: TIME_ASC) { 
          episode
          airingAt
          media { 
            id 
            idMal 
            title { english romaji } 
            coverImage { large } 
            episodes 
          } 
        } 
      } 
    }`;
  
  try {
    const response = await fetch('https://graphql.anilist.co', {
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ query: scheduleQuery, variables: { start: startTimestamp, end: endTimestamp } })
    });
    const json = await response.json();
    const schedules = json.data?.Page?.airingSchedules || [];
    
    if(schedules.length === 0) {
      scheduleBox.innerHTML = '<p class="text-gray-600 text-[11px] p-2">No ongoing broadcasts scheduled.</p>';
      return;
    }
    
    scheduleBox.innerHTML = '';
    
    // De-duplicate items inside current streaming tracks
    const mapCleanCache = new Map();
    schedules.forEach(item => {
      if (!item.media) return;
      const title = item.media.title.english || item.media.title.romaji;
      if (!mapCleanCache.has(title)) {
        mapCleanCache.set(title, item);
      }
    });

    mapCleanCache.forEach(item => {
      const title = item.media.title.english || item.media.title.romaji;
      const airDate = new Date(item.airingAt * 1000);
      const timeString = airDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      const imgUrl = item.media.coverImage?.large || "";
      
      const div = document.createElement('div');
      div.className = "scroll-row flex items-center justify-between p-2 rounded-xl bg-[#111111] border border-[#1c1c1e] hover:border-zinc-800 transition-all cursor-pointer mb-2";
      div.innerHTML = `
        <div class="flex items-center gap-3 min-w-0" onclick="switchToView('catalog'); loadStreamingLayout(${item.media.id}, ${item.media.idMal || 'null'}, '${title.replace(/'/g, "\\'")}')">
          <div class="min-w-0">
            <div class="text-xs font-semibold text-gray-200 truncate">${title}</div>
            <div class="text-[10px] text-gray-500 mt-0.5">Episode ${item.episode}</div>
          </div>
        </div>
        <span class="text-[10px] font-mono font-bold text-emerald-400 shrink-0 bg-neutral-900/80 px-2 py-1 rounded border border-[#1c1c1e]">JST ${timeString}</span>
      `;
      scheduleBox.appendChild(div);
    });
  } catch (error) { 
    console.error(error);
    scheduleBox.innerHTML = '<p class="text-red-500 text-[11px] p-2">Failed to sync broadcast calendar.</p>'; 
  }
}

function displayScrollFeed(animeArray, elementId) {
  const container = document.getElementById(elementId);
  if(!container) return;
  container.innerHTML = '';
  animeArray.forEach(anime => {
    const title = anime.title_english || anime.title;
    const imgUrl = anime.images?.jpg?.image_url;
    const div = document.createElement('div');
    div.className = "w-28 shrink-0 bg-dark-card border border-dark rounded-lg overflow-hidden group cursor-pointer transition-all text-[11px]";
    div.innerHTML = `<div class="aspect-[2/3] bg-neutral-900"><img src="${imgUrl}" class="object-cover w-full h-full"></div><div class="p-2"><h4 class="font-semibold text-white truncate">${title}</h4></div>`;
    div.onclick = async () => {
      let linkedAniId = anime.mal_id;
      try {
        const lookup = await fetch(`https://graphql.anilist.co`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: `query($id: Int) { Media(idMal: $id, type: ANIME) { id } }`, variables: { id: anime.mal_id } })
        });
        const res = await lookup.json();
        linkedAniId = res?.data?.Media?.id || anime.mal_id;
      } catch(e){}
      loadStreamingLayout(linkedAniId, anime.mal_id, title);
    };
    container.appendChild(div);
  });
}

function displayGridFeed(animeArray, elementId) {
  const container = document.getElementById(elementId);
  if(!container) return;
  container.innerHTML = '';
  animeArray.forEach(anime => {
    if (!anime.title) return;
    const title = anime.title.english || anime.title.romaji;
    const imgUrl = anime.coverImage?.large;
    const div = document.createElement('div');
    div.className = "bg-dark-card border border-dark rounded-lg overflow-hidden group cursor-pointer transition-all flex flex-col justify-between text-xs";
    div.innerHTML = `<div class="aspect-[2/3] bg-neutral-900"><img src="${imgUrl}" class="object-cover w-full h-full"></div><div class="p-2"><h4 class="font-semibold text-white truncate">${title}</h4></div>`;
    div.onclick = () => loadStreamingLayout(anime.id, anime.idMal || null, title);
    container.appendChild(div);
  });
}

function displayTop10Sidebar(animeArray) {
  const container = document.getElementById('top10-box');
  if(!container) return;
  container.innerHTML = '';
  animeArray.slice(0, 6).forEach((anime, idx) => {
    if (!anime.title) return;
    const title = anime.title.english || anime.title.romaji;
    const div = document.createElement('div');
    div.className = "flex items-center space-x-3 p-2 bg-dark-input rounded-lg border border-dark/40 transition-all cursor-pointer";
    div.innerHTML = `<span class="font-black text-sm text-gray-600 italic w-4 text-center">${idx+1}</span><span class="truncate text-gray-300 font-medium">${title}</span>`;
    div.onclick = () => loadStreamingLayout(anime.id, anime.idMal || null, title);
    container.appendChild(div);
  });
}

async function fetchJikanMetadata(malId) {
  if (!malId) return;
  try {
    const json = await fetchWithRetry(`${JIKAN_BASE}/anime/${malId}`);
    const anime = json.data;

    globalJikanEpisodeCount = anime.episodes || null;

    document.getElementById('detail-title').innerText = anime.title_english || anime.title || window.activeAnimeTitle;
    document.getElementById('detail-poster').src = anime.images?.jpg?.large_image_url || '';
    document.getElementById('detail-synopsis').innerText = anime.synopsis || "No summary available.";
    
    const epSnippet = document.getElementById('ep-synopsis-snippet');
    if (epSnippet) epSnippet.innerText = anime.synopsis || "No summary available.";
    
    document.getElementById('detail-type').innerText = anime.type || 'TV';
    document.getElementById('detail-rating').innerText = anime.score ? `${anime.score}/10` : 'N/A';
  } catch (err) {
    document.getElementById('detail-title').innerText = window.activeAnimeTitle;
  }
}

function injectProviderButtons() {
  const container = document.getElementById('server-source-tabs-bar') || document.querySelector('.server-tabs-container');
  if (!container) return;

  container.innerHTML = '';
  API_PROVIDERS.forEach(prov => {
    const btn = document.createElement('button');
    btn.id = `server-${prov.id}`;
    btn.className = "server-tab-btn px-3 py-1.5 rounded-lg border text-[11px] font-bold tracking-wide transition-all whitespace-nowrap bg-dark-input text-gray-400 border-dark cursor-pointer";
    btn.innerHTML = `${prov.name} ${prov.status === 'Unstable' ? '⚠️' : ''}`;
    btn.onclick = () => setProviderSource(prov.id);
    container.appendChild(btn);
  });
}

window.loadStreamingLayout = async function(anilistId, malId, titleName) {
  window.currentAnilistId = anilistId;
  window.currentMalId = malId;
  window.activeAnimeTitle = titleName;
  globalJikanEpisodeCount = null; // Flush clean trace

  const views = ['landing-portal', 'main-exploration-hub', 'releases-focus-view', 'calendar-focus-view'];
  views.forEach(v => document.getElementById(v)?.classList.add('hidden'));
  document.getElementById('stream-dashboard-box')?.classList.remove('hidden');
  document.getElementById('header-search-engine')?.classList.remove('hidden');
  
  const epTitle = document.getElementById('ep-title');
  if (epTitle) epTitle.innerText = `Watching: ${titleName}`;
  
  injectProviderButtons();
  updateLanguageButtonsUI();
  updateProviderButtonsUI();
  
  if (malId) {
    await fetchJikanMetadata(malId);
  } else {
    document.getElementById('detail-title').innerText = titleName;
  }

  await buildEpisodeButtonsGrid(anilistId);
};

async function buildEpisodeButtonsGrid(anilistId) {
  const epBox = document.getElementById('episode-buttons');
  if (!epBox) return;

  epBox.innerHTML = '<div class="text-xs text-gray-500 p-2 font-mono"><i class="fa-solid fa-circle-notch animate-spin mr-1.5"></i>Syncing episode feeds...</div>';

  try {
    const epData = await fetchWithRetry(`${ANIVEXA_BASE_API}/episodes/${anilistId}`);
    globalEpisodeDataCache = epData; 

    let providerList = [];
    
    if (epData) {
      if (Array.isArray(epData)) {
        const block = epData.find(item => item && item.provider === activeProviderMode);
        providerList = block ? block.episodes : [];
      } else if (epData.episodes && Array.isArray(epData.episodes)) {
        providerList = epData.episodes;
      } else if (typeof epData === 'object') {
        providerList = epData[activeProviderMode] || [];
      }
    }
    
    if ((!Array.isArray(providerList) || providerList.length === 0) && activeProviderMode !== 'megaplay') {
      const fallbackProvider = API_PROVIDERS.find(p => {
        if (!epData) return false;
        if (Array.isArray(epData)) {
          const b = epData.find(item => item && item.provider === p.id);
          return b && b.episodes && b.episodes.length > 0;
        } else if (typeof epData === 'object') {
          return epData[p.id] && epData[p.id].length > 0;
        }
        return false;
      });

      if (fallbackProvider) {
        activeProviderMode = fallbackProvider.id;
        updateProviderButtonsUI();
        
        if (Array.isArray(epData)) {
          providerList = epData.find(item => item.provider === fallbackProvider.id).episodes;
        } else {
          providerList = epData[fallbackProvider.id];
        }
      }
    }

    let totalEpisodesCount = 12;
    if (Array.isArray(providerList) && providerList.length > 0) {
      totalEpisodesCount = providerList.length;
    } else if (globalJikanEpisodeCount && globalJikanEpisodeCount > 0) {
      totalEpisodesCount = globalJikanEpisodeCount;
    }

    window.activeMaxEpisodes = totalEpisodesCount;
    epBox.innerHTML = '';

    for (let i = 1; i <= totalEpisodesCount; i++) {
      const btn = document.createElement('button');
      btn.id = `ep-btn-${i}`;
      btn.className = "bg-dark-input text-gray-400 border border-dark text-xs font-bold w-10 h-10 rounded-lg transition-all shadow-sm cursor-pointer ep-btn";
      btn.innerText = i;
      btn.onclick = () => launchVideoPlayer(i);
      epBox.appendChild(btn);
    }

    const detailEpEl = document.getElementById('detail-episodes');
    if (detailEpEl) detailEpEl.innerText = totalEpisodesCount;
    
    launchVideoPlayer(1);

  } catch (err) {
    console.warn("Failed to map live API episodes, deploying fallback metadata parameters...", err);
    
    let totalEpisodesCount = (globalJikanEpisodeCount && globalJikanEpisodeCount > 0) ? globalJikanEpisodeCount : 12;
    window.activeMaxEpisodes = totalEpisodesCount;
    epBox.innerHTML = '';
    
    for (let i = 1; i <= totalEpisodesCount; i++) {
      const btn = document.createElement('button');
      btn.id = `ep-btn-${i}`;
      btn.className = "bg-dark-input text-gray-400 border border-dark text-xs font-bold w-10 h-10 rounded-lg transition-all cursor-pointer ep-btn";
      btn.innerText = i;
      btn.onclick = () => launchVideoPlayer(i);
      epBox.appendChild(btn);
    }
    launchVideoPlayer(1);
  }
}

async function fetchAnivexaStreamList(anilistId, epNum, dubMode) {
  try {
    const category = dubMode === 'dub' ? 'dub' : 'sub';
    const cleanProvider = activeProviderMode.toLowerCase().trim();
    
    if (cleanProvider === 'reanime') {
      const redirectUrl = `${ANIVEXA_BASE_API}/stream/reanime/${anilistId}/${category}/reanime-${epNum}`;
      return [{
        name: "ReAnime Core Stream",
        type: "HLS",
        url: redirectUrl,
        isActive: true
      }];
    }

    let computedEpId = `${cleanProvider}-${epNum}`;
    if (globalEpisodeDataCache) {
      let targetList = [];
      if (Array.isArray(globalEpisodeDataCache)) {
        const block = globalEpisodeDataCache.find(item => item.provider === cleanProvider);
        if (block) targetList = block.episodes || [];
      } else if (globalEpisodeDataCache.episodes && Array.isArray(globalEpisodeDataCache.episodes)) {
        targetList = globalEpisodeDataCache.episodes;
      } else {
        targetList = globalEpisodeDataCache[cleanProvider] || [];
      }

      if (targetList && targetList.length > 0) {
        const matchedEpisodeObj = targetList.find(e => e.number == epNum || e.episode == epNum);
        if (matchedEpisodeObj && matchedEpisodeObj.id) {
          computedEpId = matchedEpisodeObj.id;
        }
      }
    }

    const watchUrl = `${ANIVEXA_BASE_API}/watch/${cleanProvider}/${anilistId}/${category}/${computedEpId}`;
    console.log(`[Anivexa API Request] -> ${watchUrl}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); 

    const watchRes = await fetch(watchUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!watchRes.ok) throw new Error("Server response offline fallback status code");
    const watchData = await watchRes.json();
    
    if (watchData && Array.isArray(watchData.streams)) {
      return watchData.streams; 
    } else if (watchData && watchData.url) {
      const isHLS = watchData.url.includes('.m3u8');
      return [{ 
        name: `${activeProviderMode.toUpperCase()} Mirror`, 
        type: isHLS ? "HLS" : "Embed", 
        url: watchData.url, 
        isActive: true 
      }];
    }
    
    return null;
  } catch (e) {
    console.warn(`[Anivexa Stream Router Exception]:`, e);
    return [{
      name: `${activeProviderMode.toUpperCase()} Local Sandbox (API Offline)`,
      type: "HLS",
      url: MOCK_FALLBACK_STREAM_URL,
      isActive: true
    }];
  }
}

function renderSubServerGrid(streams) {
  let serverGridContainer = document.getElementById('sub-server-links-grid');
  
  if (!serverGridContainer) {
    const targetParent = document.getElementById('episode-buttons')?.parentElement;
    if (!targetParent) return;
    
    const sectionWrapper = document.createElement('div');
    sectionWrapper.className = "mt-6";
    sectionWrapper.innerHTML = `<div id="sub-server-links-grid" class="space-y-4 mb-6"></div>`;
    targetParent.appendChild(sectionWrapper);
    serverGridContainer = document.getElementById('sub-server-links-grid');
  }

  serverGridContainer.innerHTML = '';

  const hlsStreams = streams.filter(s => s.url.includes('.m3u8') || (s.type && s.type.toUpperCase() === 'HLS'));
  const fallbackStreams = streams.filter(s => !s.url.includes('.m3u8') && (!s.type || s.type.toUpperCase() !== 'HLS'));

  if (hlsStreams.length > 0) {
    const internalGroup = document.createElement('div');
    internalGroup.className = "bg-[#111116] border border-zinc-900 rounded-xl p-4";
    internalGroup.innerHTML = `
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <i class="fa-solid fa-bolt text-xs text-purple-400"></i>
          <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider">HLS Streams (Internal Player)</h3>
        </div>
        <span class="text-[10px] font-mono font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded-full">${hlsStreams.length} Available</span>
      </div>
      <div id="hls-links-subgrid" class="grid grid-cols-2 gap-2.5"></div>
    `;
    serverGridContainer.appendChild(internalGroup);
    
    const hlsGrid = document.getElementById('hls-links-subgrid');
    hlsStreams.forEach((stream, idx) => {
      createStreamPillElement(stream, `hls-${idx}`, hlsGrid, streams);
    });
  }

  if (fallbackStreams.length > 0) {
    const externalGroup = document.createElement('div');
    externalGroup.className = "bg-[#111116] border border-zinc-900 rounded-xl p-4";
    externalGroup.innerHTML = `
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <i class="fa-solid fa-link text-xs text-zinc-400"></i>
          <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider">Iframe Embed Mirrors (Side Content)</h3>
        </div>
        <span class="text-[10px] font-mono font-bold bg-zinc-800 text-zinc-400 border border-zinc-700/60 px-2 py-0.5 rounded-full">${fallbackStreams.length} Links</span>
      </div>
      <div id="fallback-links-subgrid" class="grid grid-cols-2 gap-2.5"></div>
    `;
    serverGridContainer.appendChild(externalGroup);
    
    const fallbackGrid = document.getElementById('fallback-links-subgrid');
    fallbackStreams.forEach((stream, idx) => {
      createStreamPillElement(stream, `fallback-${idx}`, fallbackGrid, streams);
    });
  }
}

function createStreamPillElement(stream, uniquelyIdentifiedId, parentGridContainer, masterStreamsArray) {
  const pill = document.createElement('div');
  pill.id = `stream-link-pill-${uniquelyIdentifiedId}`;
  pill.className = "bg-[#16161c] border border-zinc-800/80 rounded-xl p-3 flex flex-col justify-between cursor-pointer select-none transition-all hover:scale-[1.01] group";
  
  const labelType = stream.url.includes('.m3u8') ? 'HLS' : (stream.type || 'Embed');
  const typeBadgeStyles = labelType === 'HLS' 
    ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' 
    : 'bg-zinc-800 text-zinc-400 border-zinc-700/50';

  pill.innerHTML = `
    <div class="flex items-start justify-between gap-2">
      <h4 class="text-xs font-bold text-gray-200 transition-colors server-name-text truncate">${stream.name || 'Mirror Source'}</h4>
      <span class="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded border tracking-wide uppercase shrink-0 ${typeBadgeStyles}">${labelType}</span>
    </div>
    <div class="flex items-center gap-3 text-[10px] text-gray-500 font-mono mt-2.5 pt-2 border-t border-zinc-800/40 group-hover:text-gray-400">
      <span><i class="fa-regular fa-thumbs-up mr-1.5"></i>--</span>
      <span><i class="fa-regular fa-thumbs-down mr-1.5"></i>--</span>
    </div>
  `;

  if (stream.isActive) {
    applyActivePillStyles(pill);
  }

  pill.onclick = () => {
    masterStreamsArray.forEach((_, idx) => {
      const p1 = document.getElementById(`stream-link-pill-hls-${idx}`);
      const p2 = document.getElementById(`stream-link-pill-fallback-${idx}`);
      if (p1) removeActivePillStyles(p1);
      if (p2) removeActivePillStyles(p2);
    });

    applyActivePillStyles(pill);
    executeStreamRouting(stream.url, labelType);
  };

  parentGridContainer.appendChild(pill);
}

function applyActivePillStyles(element) {
  element.style.backgroundColor = '#ffffff';
  element.style.borderColor = '#ffffff';
  const nameTxt = element.querySelector('.server-name-text');
  if (nameTxt) nameTxt.style.color = '#000000';
  element.querySelectorAll('span, i').forEach(el => {
    if (!el.classList.contains('border')) el.style.color = '#4b5563';
  });
}

function removeActivePillStyles(element) {
  element.style.backgroundColor = '';
  element.style.borderColor = '';
  const nameTxt = element.querySelector('.server-name-text');
  if (nameTxt) nameTxt.style.color = '';
  element.querySelectorAll('span, i').forEach(el => {
    if (!el.classList.contains('border')) el.style.color = '';
  });
}

function executeStreamRouting(streamUrl, streamType) {
  const layoutWrapper = document.getElementById('video-player-wrapper');
  if (!layoutWrapper) return;

  if (streamUrl && (streamUrl.includes('big_buck_bunny') || streamUrl.includes('x36xhzz.m3u8') || streamUrl.includes('sample.mp4'))) {
    console.warn("[StreamGuard] Intercepted test placeholder stream URL:", streamUrl);
    if (window.currentHlsInstance) { window.currentHlsInstance.destroy(); window.currentHlsInstance = null; }
    if (window.currentPlyr) { window.currentPlyr.destroy(); window.currentPlyr = null; }
    clearTimeout(window.streamLoadGuard);
    handleStreamMissingNotice();
    return;
  }

  const isHLSSource = (streamType && streamType.toUpperCase() === 'HLS') || streamUrl.includes('.m3u8') || activeProviderMode === 'reanime';
  
  if (window.currentHlsInstance) {
    window.currentHlsInstance.destroy();
    window.currentHlsInstance = null;
  }
  if (window.currentPlyr) {
    window.currentPlyr.destroy();
    window.currentPlyr = null;
  }

  if (isHLSSource) {
    layoutWrapper.innerHTML = `
      <video id="video-iframe" controls playsinline class="w-full h-full rounded-xl bg-black"></video>
      <div id="notice-overlay" class="hidden absolute inset-0 flex items-center justify-center bg-black/90 z-40 text-center p-4">
        <p class="text-xs font-semibold text-gray-400 font-mono tracking-wider"></p>
      </div>`;
    
    const videoElement = document.getElementById('video-iframe');

    if (typeof Hls !== 'undefined' && Hls.isSupported()) {
      window.currentHlsInstance = new Hls({
        maxMaxBufferLength: 30, 
        enableWorker: true
      });
      window.currentHlsInstance.loadSource(streamUrl);
      window.currentHlsInstance.attachMedia(videoElement);
      
      window.currentHlsInstance.on(Hls.Events.MANIFEST_PARSED, function() {
        initializePlyrEngine(videoElement);
        videoElement.play().catch(() => console.log("Autoplay block caught"));
      });

      window.currentHlsInstance.on(Hls.Events.ERROR, function (event, data) {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              window.currentHlsInstance.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              window.currentHlsInstance.recoverMediaError();
              break;
            default:
              handleStreamMissingNotice();
              break;
          }
        }
      });
    } else if (videoElement && videoElement.canPlayType('application/vnd.apple.mpegurl')) {
      videoElement.src = streamUrl;
      initializePlyrEngine(videoElement);
    } else {
      handleStreamMissingNotice();
    }
  } else {
    layoutWrapper.innerHTML = `
      <iframe id="video-iframe" class="w-full h-full rounded-xl bg-black" allowfullscreen frameborder="0" src="${streamUrl}"></iframe>
      <div id="notice-overlay" class="hidden absolute inset-0 flex items-center justify-center bg-black/90 z-40 text-center p-4">
        <p class="text-xs font-semibold text-gray-400 font-mono tracking-wider"></p>
      </div>`;
  }
}

function initializePlyrEngine(videoElement) {
  try {
    if (typeof Plyr !== 'undefined' && videoElement) {
      const currentActivePreset = presets[currentPresetName] || presets.subaru;

      window.currentPlyr = new Plyr(videoElement, {
        controls: ['play-large', 'play', 'progress', 'current-time', 'duration', 'mute', 'volume', 'settings', 'fullscreen'],
        keyboard: { focused: true, global: true },
        tooltips: { controls: true, seek: true }
      });

      document.documentElement.style.setProperty('--plyr-color-main', currentActivePreset.hex);
    }
  } catch(err) {
    console.warn("[Media Hub] Plyr failed to load:", err);
  }
}

async function launchVideoPlayer(epNum) {
  currentEpisodeIndex = epNum;
  updateEpisodeButtonsUI();

  // Reset core element views and overlay items immediately upon invocation
  const videoCore = document.getElementById('video-iframe');
  if (videoCore) videoCore.classList.remove('hidden');
  const overlayNotice = document.getElementById('notice-overlay');
  if (overlayNotice) overlayNotice.classList.add('hidden');

  if (activeProviderMode === 'megaplay') {
    const layoutWrapper = document.getElementById('video-player-wrapper');
    const oldGrid = document.getElementById('sub-server-links-grid');
    if (oldGrid) oldGrid.innerHTML = '';

    if (layoutWrapper) {
      layoutWrapper.innerHTML = `
        <iframe id="video-iframe" class="w-full h-full rounded-xl bg-black" allowfullscreen frameborder="0" scrolling="no" src=""></iframe>
        <div id="notice-overlay" class="hidden absolute inset-0 flex items-center justify-center bg-black/90 z-40 text-center p-4">
          <p class="text-xs font-semibold text-gray-400 font-mono tracking-wider"></p>
        </div>`;
      
      const iframe = document.getElementById('video-iframe');
      const targetMalId = window.currentMalId || 1; 
      
      clearTimeout(window.streamLoadGuard);
      window.streamLoadGuard = null;

      iframe.src = `${MEGAPLAY_PLAYER_BASE}/${targetMalId}/${epNum}/${currentLanguage}`;
    }
    return;
  }

  const oldGrid = document.getElementById('sub-server-links-grid');
  if (oldGrid) oldGrid.innerHTML = '';

  const streamsList = await fetchAnivexaStreamList(window.currentAnilistId, epNum, currentLanguage);
  
  if (streamsList && streamsList.length > 0) {
    const defaultStream = streamsList.find(s => s.isActive && s.url.includes('.m3u8')) 
      || streamsList.find(s => s.url.includes('.m3u8')) 
      || streamsList.find(s => s.isActive) 
      || streamsList[0];
      
    if (defaultStream && defaultStream.url && (defaultStream.url.includes('big_buck_bunny') || defaultStream.url.includes('x36xhzz.m3u8') || defaultStream.url.includes('sample.mp4'))) {
      console.warn("[StreamGuard] Cancelled rendering; placeholder test mirror received.");
      handleStreamMissingNotice();
      return;
    }

    renderSubServerGrid(streamsList);
    const calculatedType = (defaultStream.url.includes('.m3u8') || activeProviderMode === 'reanime') ? 'HLS' : (defaultStream.type || 'Embed');
    executeStreamRouting(defaultStream.url, calculatedType);
  } else {
    handleStreamMissingNotice();
  }
}

function updateEpisodeButtonsUI() {
  const currentActiveHex = document.querySelector('.dynamic-accent-text')?.style.color || 'rgb(0, 255, 102)';
  const curPreset = presets[currentPresetName] || presets.subaru;

  for (let i = 1; i <= window.activeMaxEpisodes; i++) {
    const btn = document.getElementById(`ep-btn-${i}`);
    if (btn) {
      if (i === currentEpisodeIndex) {
        btn.style.backgroundColor = currentActiveHex;
        btn.style.color = curPreset.textLight ? '#ffffff' : '#000000';
        btn.style.borderColor = currentActiveHex;
      } else {
        btn.style.backgroundColor = '';
        btn.style.color = '';
        btn.style.borderColor = '';
      }
    }
  }
}

function setProviderSource(providerId) {
  activeProviderMode = providerId;
  updateProviderButtonsUI();
  
  clearTimeout(window.streamLoadGuard);
  window.streamLoadGuard = null;
  
  launchVideoPlayer(currentEpisodeIndex);
}

function updateProviderButtonsUI() {
  const currentActiveHex = document.querySelector('.dynamic-accent-text')?.style.color || 'rgb(0, 255, 102)';
  const curPreset = presets[currentPresetName] || presets.subaru;
  
  API_PROVIDERS.forEach(prov => {
    const btn = document.getElementById(`server-${prov.id}`);
    if (!btn) return;
    if (activeProviderMode === prov.id) {
      btn.style.backgroundColor = currentActiveHex;
      btn.style.color = curPreset.textLight ? '#ffffff' : '#000000';
      btn.style.borderColor = currentActiveHex;
    } else {
      btn.style.backgroundColor = '';
      btn.style.color = '';
      btn.style.borderColor = '';
    }
  });
}

function handleStreamMissingNotice() {
  const videoCore = document.getElementById('video-iframe');
  if (videoCore) videoCore.classList.add('hidden');

  const noticeOverlay = document.getElementById('notice-overlay');
  if (noticeOverlay) {
    noticeOverlay.classList.remove('hidden');
    const txt = noticeOverlay.querySelector('p');
    if (txt) txt.innerText = `Source empty on provider: "${activeProviderMode.toUpperCase()}". Try switching tabs above.`;
  }
}

function setLanguage(lang) {
  currentLanguage = lang;
  updateLanguageButtonsUI();
  launchVideoPlayer(currentEpisodeIndex);
}

function updateLanguageButtonsUI() {
  const currentActiveHex = document.querySelector('.dynamic-accent-text')?.style.color || 'rgb(0, 255, 102)';
  const curPreset = presets[currentPresetName] || presets.subaru;

  ['sub', 'dub'].forEach(l => {
    const btn = document.getElementById(`${l}-btn`);
    if(!btn) return;
    if (currentLanguage === l) {
      btn.style.backgroundColor = currentActiveHex;
      btn.style.color = curPreset.textLight ? '#ffffff' : '#000000';
      btn.style.borderColor = currentActiveHex;
    } else {
      btn.style.backgroundColor = '';
      btn.style.color = '';
      btn.style.borderColor = '';
    }
  });
}

// Autoplay & Message Handshake Interceptor
window.addEventListener("message", function (event) {
  let data = event.data;
  
  if (typeof data === "string") { 
    try { 
      data = JSON.parse(data); 
    } catch (e) { 
      return; 
    } 
  }
  
  if (!data || typeof data !== 'object') return;
  
  if (data.event === "playing" || data.event === "ready") {
    clearTimeout(window.streamLoadGuard);
    window.streamLoadGuard = null;
    return;
  }
  
  if (data.event === "error" || data.status === "error") {
    clearTimeout(window.streamLoadGuard);
    window.streamLoadGuard = null;
    handleStreamMissingNotice();
    return;
  }

  if (data.event === "complete" || data.event === "ended" || data.status === "finished") {
    const nextEp = currentEpisodeIndex + 1;
    if (nextEp <= window.activeMaxEpisodes) {
      launchVideoPlayer(nextEp);
    }
  }
});

window.onload = function() {
  startSystemClock();
  applyCharacterPreset('subaru');
  switchToView('home');
};
