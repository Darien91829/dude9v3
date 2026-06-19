const JIKAN_BASE = "https://api.jikan.moe/v4";

// YOUR STANDALONE STREAMING API HOSTED ON VERCEL
const ANIVEXA_BASE_API = "https://anivexa-api-eta.vercel.app";

let currentEpisodeIndex = 1;
let currentLanguage = 'sub';
let activeScheduleDay = 'today';
let activeProviderMode = 'allmanga'; // Default active provider

// Track all available backend providers from your API manifest (Spliced MegaPlay Core)
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

// Guard items to stop loop updates on view toggle
let hubFeedsLoaded = false;
let recentReleasesLoaded = false;
let calendarLoaded = false;
let currentPresetName = 'subaru';
let selectedDayFilter = '';

// Store the fetched server episode mapping objects globally so we can access real API data IDs
let globalEpisodeDataCache = null;

window.currentAnilistId = null;
window.currentMalId = null;
window.activeAnimeTitle = "";
window.activeMaxEpisodes = 12;

// Store global hls.js reference to destroy it during stream context switching
window.currentHlsInstance = null;

const presets = {
  subaru: { hex: '#f97316', bg: '#0f0f12', card: '#16161c', input: '#121216', border: '#22222a', textLight: false },
  emilia: { hex: '#c084fc', bg: '#0d0a12', card: '#14101c', input: '#1e182a', border: '#2b223a', textLight: true },
  rem: { hex: '#38bdf8', bg: '#090e14', card: '#101620', input: '#182230', border: '#22324a', textLight: false },
  ram: { hex: '#fb7185', bg: '#140c0e', card: '#201317', input: '#2d1b20', border: '#3e252c', textLight: false },
  beatrice: { hex: '#fbbf24', bg: '#14110c', card: '#201a12', input: '#2d251a', border: '#3e3324', textLight: false },
  felt: { hex: '#eab308', bg: '#12110a', card: '#1c1a10', input: '#2a2718', border: '#3a3621', textLight: false },
  reinhard: { hex: '#dc2626', bg: '#140b0b', card: '#201111', input: '#2e1919', border: '#402222', textLight: true },
  crusch: { hex: '#059669', bg: '#0a120e', card: '#101c16', input: '#182b22', border: '#223d30', textLight: true },
  felix: { hex: '#d97706', bg: '#140b0b', card: '#201911', input: '#2e2419', border: '#403222', textLight: false },
  priscilla: { hex: '#ef4444', bg: '#120a0a', card: '#1c1010', input: '#2a1818', border: '#3a2121', textLight: true },
  anastasia: { hex: '#f472b6', bg: '#140d11', card: '#20141b', input: '#2e1d27', border: '#402937', textLight: false },
  julius: { hex: '#818cf8', bg: '#0d0d14', card: '#141420', input: '#1e1e2e', border: '#2a2a40', textLight: true },
  wilhelm: { hex: '#94a3b8', bg: '#0f1115', card: '#171a21', input: '#222630', border: '#303645', textLight: false },
  roswaal: { hex: '#4f46e5', bg: '#0b0a14', card: '#111020', input: '#19182e', border: '#232240', textLight: true },
  satella: { hex: '#6d28d9', bg: '#0a0812', card: '#100c1c', input: '#18122b', border: '#231b3d', textLight: true },
  echidna: { hex: '#e4e4e7', bg: '#101012', card: '#18181c', input: '#24242a', border: '#34343a', textLight: false }
};

const delay = ms => new Promise(res => setTimeout(res, ms));

async function fetchWithRetry(url, options = {}, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return await response.json();
      if (response.status === 429) throw new Error("Rate limited");
    } catch (err) {
      if (i === retries - 1) throw err;
      await delay(2000 * (i + 1)); 
    }
  }
}

function applyCharacterPreset(name) {
  const p = presets[name]; if (!p) return;
  currentPresetName = name;
  document.body.style.backgroundColor = p.bg;
  
  // Custom Dynamic Global Variable mappings for Tailwind Injection
  document.documentElement.style.setProperty('--character-accent', p.hex);
  document.documentElement.style.setProperty('--character-accent-hover', p.hex);
  
  // Convert hex color values down to plain RGB tracks dynamically
  const r = parseInt(p.hex.slice(1, 3), 16);
  const g = parseInt(p.hex.slice(3, 5), 16);
  const b = parseInt(p.hex.slice(5, 7), 16);
  document.documentElement.style.setProperty('--character-accent-rgb', `${r}, ${g}, ${b}`);

  document.querySelectorAll('#main-menu-drawer, nav.sticky').forEach(el => el.style.backgroundColor = p.bg);
  document.querySelectorAll('.bg-dark-card').forEach(el => el.style.backgroundColor = p.card);
  document.querySelectorAll('.bg-dark-input').forEach(el => el.style.backgroundColor = p.input);
  document.querySelectorAll('.border-dark-border').forEach(el => el.style.borderColor = p.border);
  document.querySelectorAll('.dynamic-accent-text').forEach(el => el.style.color = p.hex);
  document.querySelectorAll('.dynamic-accent-bg').forEach(el => {
    el.style.backgroundColor = p.hex; el.style.color = p.textLight ? '#ffffff' : '#000000';
  });
  
  updateProviderButtonsUI();
  updateLanguageButtonsUI();
  if (window.currentAnilistId) updateEpisodeButtonsUI();
  
  const tabAct = document.getElementById(`tab-${activeScheduleDay}`);
  if(tabAct) { tabAct.style.backgroundColor = p.hex; tabAct.style.color = p.textLight ? '#ffffff' : '#000000'; }

  document.querySelectorAll('.consumet-card-item').forEach(card => {
    card.addEventListener('mouseenter', () => card.style.borderColor = `${p.hex}4d`);
    card.addEventListener('mouseleave', () => card.style.borderColor = 'transparent');
  });
  renderCalendarGridStructure();
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
  const currentAccentColor = presets[currentPresetName]?.hex || '#f97316';
  const currentTextLight = presets[currentPresetName]?.textLight || false;
  
  for (let i = 0; i < 7; i++) {
    const dayBox = document.createElement('button');
    dayBox.className = "bg-[#16161a] border border-gray-800/80 rounded-xl py-3 px-1 flex flex-col items-center justify-center text-[11px] font-bold text-gray-400 transition-all select-none hover:border-gray-600";
    
    dayBox.innerHTML = `
      <span class="text-[9px] text-gray-500 uppercase tracking-tight mb-0.5">${daysShort[i].slice(0,2)}</span>
      <span>${daysShort[i]}</span>
    `;
    
    if (selectedDayFilter === daysFull[i]) {
      dayBox.style.backgroundColor = currentAccentColor;
      dayBox.style.borderColor = currentAccentColor;
      dayBox.style.color = currentTextLight ? '#ffffff' : '#000000';
    } else if (i === todayDayIndex && !selectedDayFilter) {
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
      <i class="fa-solid fa-circle-notch animate-spin text-sm mr-2 dynamic-accent-text"></i> Syncing AniList broadcast tracks...
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
        <div class="flex items-center justify-between border-b border-dark-border pb-2 mb-3">
          <h3 class="text-xs font-bold text-gray-300 uppercase tracking-wider">${displayDayLabel}</h3>
          <span class="text-[10px] text-gray-500 font-medium font-mono">${animeList.length} titles</span>
        </div>
        <div class="space-y-2">
      `;

      animeList.forEach(item => {
        const anime = item.media;
        const title = anime.title.english || anime.title.romaji;
        const scoreDisplay = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : 'N/A';
        const airDate = new Date(item.airingAt * 1000);
        const airTime = airDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

        listHtml += `
          <div onclick="switchToView('catalog'); loadStreamingLayout(${anime.id}, ${anime.idMal || 'null'}, '${title.replace(/'/g, "\\'")}')"
               class="flex items-center justify-between p-2 rounded-xl bg-transparent hover:bg-neutral-900/40 cursor-pointer transition-all group">
            <div class="flex items-center gap-3 min-w-0">
              <img src="${anime.coverImage?.large}" class="w-10 h-10 object-cover rounded-lg shrink-0 border border-dark-border">
              <div class="min-w-0">
                <h4 class="text-xs font-semibold text-gray-200 group-hover:text-white transition-colors truncate">${title}</h4>
                <p class="text-[10px] text-gray-500 mt-0.5 font-mono">${anime.type || 'TV'} &bull; Ep ${item.episode} &bull; Score: ${scoreDisplay}</p>
              </div>
            </div>
            <span class="text-[10px] font-mono font-bold text-gray-400 shrink-0 bg-zinc-900/80 px-2 py-1 rounded border border-dark-border">${airTime}</span>
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
    applyCharacterPreset(currentPresetName);
  } catch (err) {
    console.error(err);
    listContainer.innerHTML = `
      <div class="text-center py-6">
        <p class="text-xs text-red-500 mb-3">AniList data hub temporary standby.</p>
        <button onclick="fetchAndRenderChronologicalList()" class="bg-orange-500 text-black px-4 py-1.5 rounded-full text-xs font-bold transition-transform active:scale-95">Retry Connection</button>
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
        const currentHex = presets[currentPresetName]?.hex || '#f97316';
        cardFrame.style.borderColor = `${currentHex}4d`;
        cardFrame.querySelector('.consumet-card-title').style.color = currentHex;
      });
      cardFrame.addEventListener('mouseleave', () => {
        cardFrame.style.borderColor = 'transparent';
        cardFrame.querySelector('.consumet-card-title').style.color = '#ffffff';
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
        <button onclick="loadRecentReleases()" class="bg-orange-500 text-black px-4 py-1.5 rounded-full text-xs font-bold transition-transform active:scale-95">Retry Connection</button>
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
  fetchLiveReleasingSchedule(activeScheduleDay);
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
  ['yesterday', 'today', 'tomorrow'].forEach(day => {
    const b = document.getElementById(`tab-${day}`); if(b) { b.style.backgroundColor = 'transparent'; b.style.color = '#6b7280'; }
  });
  const currentPreset = presets[currentPresetName] || presets.subaru;
  const act = document.getElementById(`tab-${targetDay}`);
  if(act) { act.style.backgroundColor = currentPreset.hex; act.style.color = currentPreset.textLight ? '#ffffff' : '#000000'; }
  fetchLiveReleasingSchedule(targetDay);
}

async function fetchLiveReleasingSchedule(dayMode) {
  const scheduleBox = document.getElementById('schedule-box');
  if(!scheduleBox) return;
  scheduleBox.innerHTML = '<p class="text-gray-500 text-[11px]">Querying timelines...</p>';
  
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
      scheduleBox.innerHTML = '<p class="text-gray-600 text-[11px]">No items found for this window.</p>';
      return;
    }
    
    scheduleBox.innerHTML = '';
    schedules.forEach(item => {
      if (!item.media) return;
      const title = item.media.title.english || item.media.title.romaji;
      const airDate = new Date(item.airingAt * 1000);
      const timeString = airDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      
      const div = document.createElement('div');
      div.className = "flex items-center justify-between p-2 bg-dark-input rounded-lg border border-dark-border cursor-pointer transition-all";
      div.innerHTML = `
        <div class="flex flex-col truncate pr-2">
          <span class="truncate font-medium text-gray-300">${title}</span>
          <span class="text-[9px] text-gray-500">Episode ${item.episode}</span>
        </div>
        <span class="font-mono text-[10px] dynamic-accent-text shrink-0">${timeString}</span>
      `;
      div.onclick = () => loadStreamingLayout(item.media.id, item.media.idMal || null, title);
      scheduleBox.appendChild(div);
    });
    applyCharacterPreset(currentPresetName);
  } catch (error) { 
    console.error(error);
    scheduleBox.innerHTML = `<p class="text-red-500 text-[11px]">Failed to parse calendar items.</p>`; 
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
    div.className = "w-28 shrink-0 bg-dark-card border border-dark-border rounded-lg overflow-hidden group cursor-pointer transition-all text-[11px]";
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
    div.className = "bg-dark-card border border-dark-border rounded-lg overflow-hidden group cursor-pointer transition-all flex flex-col justify-between text-xs";
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
    div.className = "flex items-center space-x-3 p-2 bg-dark-input rounded-lg border border-dark-border cursor-pointer transition-all";
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

    document.getElementById('detail-title').innerText = anime.title_english || anime.title || window.activeAnimeTitle;
    document.getElementById('detail-poster').src = anime.images?.jpg?.large_image_url || '';
    document.getElementById('detail-synopsis').innerText = anime.synopsis || "No summary available.";
    document.getElementById('ep-synopsis-snippet').innerText = anime.synopsis || "No summary available.";
    document.getElementById('detail-type').innerText = anime.type || 'TV';
    document.getElementById('detail-rating').innerText = anime.score ? `${anime.score}/10` : 'N/A';
  } catch (err) {
    document.getElementById('detail-title').innerText = window.activeAnimeTitle;
  }
}

function injectProviderButtons() {
  const container = document.getElementById('server-source-tabs-bar');
  if (!container) return;

  container.innerHTML = '';
  API_PROVIDERS.forEach(prov => {
    const btn = document.createElement('button');
    btn.id = `server-${prov.id}`;
    btn.className = "px-3 py-1.5 rounded-lg border text-[11px] font-bold tracking-wide transition-all whitespace-nowrap bg-dark-input text-gray-400 border-dark-border";
    btn.innerHTML = `${prov.name} ${prov.status === 'Unstable' ? '⚠️' : ''}`;
    btn.onclick = () => setProviderSource(prov.id);
    container.appendChild(btn);
  });
  updateProviderButtonsUI();
}

function updateProviderButtonsUI() {
  const currentAccent = presets[currentPresetName]?.hex || '#f97316';
  const currentTextLight = presets[currentPresetName]?.textLight || false;
  
  API_PROVIDERS.forEach(prov => {
    const btn = document.getElementById(`server
