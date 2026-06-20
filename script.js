const JIKAN_BASE = "https://api.jikan.moe/v4";

// YOUR STANDALONE STREAMING API HOSTED ON VERCEL
const ANIVEXA_BASE_API = "https://anivexa-api-eta.vercel.app";

let currentEpisodeIndex = 1;
let currentLanguage = 'sub';
let activeScheduleDay = 'today';
let activeProviderMode = 'allmanga'; // Default active provider

// Track all available backend providers from your API manifest
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
window.currentPlyr = null;

const presets = {
  subaru: { hex: '#f97316', bg: '#0f0f12', card: '#16161c', input: '#121216', textLight: false },
  umi: { hex: '#4169e1', bg: '#0f0f12', card: '#16161c', input: '#121216', textLight: true },
  alya: { hex: '#a1a1aa', bg: '#0f0f12', card: '#16161c', input: '#121216', textLight: false },
  emilia: { hex: '#c084fc', bg: '#0d0a12', card: '#14101c', input: '#1e182a', textLight: true },
  rem: { hex: '#38bdf8', bg: '#090e14', card: '#101620', input: '#182230', textLight: false },
  ram: { hex: '#fb7185', bg: '#140c0e', card: '#201317', input: '#2d1b20', textLight: false },
  beatrice: { hex: '#fbbf24', bg: '#14110c', card: '#201a12', input: '#2d251a', textLight: false },
  felt: { hex: '#eab308', bg: '#12110a', card: '#1c1a10', input: '#2a2718', textLight: false },
  reinhard: { hex: '#dc2626', bg: '#140b0b', card: '#201111', input: '#2e1919', textLight: true },
  crusch: { hex: '#059669', bg: '#0a120e', card: '#101c16', input: '#182b22', textLight: true },
  felix: { hex: '#d97706', bg: '#140b0b', card: '#201911', input: '#2e2419', textLight: false },
  priscilla: { hex: '#ef4444', bg: '#120a0a', card: '#1c1010', input: '#2a1818', textLight: true },
  anastasia: { hex: '#f472b6', bg: '#140d11', card: '#20141b', input: '#2e1d27', textLight: false },
  julius: { hex: '#6366f1', bg: '#0d0d14', card: '#141420', input: '#1e1e2e', textLight: true },
  wilhelm: { hex: '#94a3b8', bg: '#0f1115', card: '#171a21', input: '#222630', textLight: false },
  roswaal: { hex: '#4f46e5', bg: '#0b0a14', card: '#111020', input: '#19182e', textLight: true },
  satella: { hex: '#6d28d9', bg: '#0a0812', card: '#100c1c', input: '#18122b', textLight: true },
  echidna: { hex: '#e2e8f0', bg: '#101012', card: '#18181c', input: '#24242a', textLight: false },
  megaplay: { hex: '#00ffff', bg: '#0a0d14', card: '#111622', input: '#192030', textLight: false }
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
  
  // Apply theme variables dynamically to match CSS properties
  document.documentElement.style.setProperty('--character-accent', p.hex);
  document.documentElement.style.setProperty('--character-accent-hover', p.hex + 'cc');
  
  document.body.style.backgroundColor = p.bg;
  document.querySelectorAll('.sidebar, #main-menu-drawer').forEach(el => el.style.backgroundColor = p.bg);
  document.querySelectorAll('.bg-dark-card').forEach(el => el.style.backgroundColor = p.card);
  document.querySelectorAll('.bg-dark-input').forEach(el => el.style.backgroundColor = p.input);
  document.querySelectorAll('.border-dark, .border-dark-border').forEach(el => el.style.borderColor = p.input);
  document.querySelectorAll('.dynamic-accent-text').forEach(el => el.style.color = p.hex);
  
  document.querySelectorAll('.dynamic-accent-bg').forEach(el => {
    el.style.backgroundColor = p.hex; 
    el.style.color = p.textLight ? '#ffffff' : '#000000';
  });
  
  updateProviderButtonsUI();
  updateLanguageButtonsUI();
  if (window.currentAnilistId) updateEpisodeButtonsUI();
  
  const tabAct = document.getElementById(`tab-${activeScheduleDay}`);
  if(tabAct) { 
    tabAct.style.backgroundColor = p.hex; 
    tabAct.style.color = p.textLight ? '#ffffff' : '#000000'; 
  }

  document.querySelectorAll('.consumet-card-item').forEach(card => {
    card.addEventListener('mouseenter', () => card.style.borderColor = `${p.hex}4d`);
    card.addEventListener('mouseleave', () => card.style.borderColor = 'transparent');
  });
  
  if (calendarLoaded) {
    renderCalendarGridStructure();
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
}

function filterCalendarGrid() {
  const searchInput = document.getElementById('calendar-search');
  if (searchInput) {
    fetchAndRenderChronologicalList(searchInput.value.trim());
  }
}

function resetCalendarGridDay() {
  selectedDayFilter = '';
  const searchInput = document.getElementById('calendar-search');
  if (searchInput) searchInput.value = '';
  renderCalendarGridStructure();
  fetchAndRenderChronologicalList();
}

function renderCalendarGridStructure() {
  const matrixContainer = document.getElementById('calendar-days-matrix');
  if (!matrixContainer) return;
  matrixContainer.innerHTML = '';

  const todayDayIndex = new Date().getDay(); 
  const daysFull = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const daysShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const currentAccentColor = document.querySelector('.dynamic-accent-text')?.style.color || '#00ff66';
  
  for (let i = 0; i < 7; i++) {
    const dayBox = document.createElement('button');
    dayBox.className = "bg-[#16161c] border border-dark-border rounded-xl py-3 px-1 flex flex-col items-center justify-center text-[11px] font-bold text-gray-400 transition-all select-none hover:border-gray-600";
    
    dayBox.innerHTML = `
      <span class="text-[9px] text-gray-500 uppercase tracking-tight mb-0.5">${daysShort[i].slice(0,2)}</span>
      <span>${daysShort[i]}</span>
    `;
    
    if (selectedDayFilter === daysFull[i]) {
      dayBox.style.backgroundColor = currentAccentColor;
      dayBox.style.borderColor = currentAccentColor;
      dayBox.style.color = '#000000';
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
    <div class="text-center py-8 text-xs text-gray-500 col-span-full">
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
      listContainer.innerHTML = `<div class="text-xs text-gray-500 py-4 text-center col-span-full">No scheduled items found.</div>`;
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
      daySection.className = "col-span-full mb-4";

      let displayDayLabel = dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1);
      if (dayLabel === todayName) {
        displayDayLabel = `${displayDayLabel} &bull; Today`;
      }

      let listHtml = `
        <div class="flex items-center justify-between border-b border-dark-border pb-2 mb-3">
          <h3 class="text-xs font-bold text-gray-300 uppercase tracking-wider">${displayDayLabel}</h3>
          <span class="text-[10px] text-gray-500 font-medium font-mono">${animeList.length} titles</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      `;
      
      animeList.forEach(item => {
        const anime = item.media;
        const title = anime.title.english || anime.title.romaji;
        const airDate = new Date(item.airingAt * 1000);
        const airTime = airDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        const scoreDisplay = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : 'N/A';
        
        listHtml += `
          <div onclick="switchToView('catalog'); loadStreamingLayout(${anime.id}, ${anime.idMal || 'null'}, '${title.replace(/'/g, "\\'")}')" class="flex items-center justify-between p-2 rounded-xl bg-dark-card border border-dark-border hover:bg-neutral-900/40 cursor-pointer transition-all group">
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
  } catch (error) {
    console.error(error);
  }
}

// Intercept window postMessage triggers for MegaPlay tracking metrics
window.addEventListener("message", function (event) {
  let data = event.data;
  if (typeof data === "string") {
    try { data = JSON.parse(data); } catch (e) { return; }
  }
  // Listen to auto-advance requests from MegaPlay or MegaCloud iframe instances
  if (data && (data.event === "complete" || data.event === "ended" || data.status === "finished")) {
    const nextEp = currentEpisodeIndex + 1;
    if (nextEp <= window.activeMaxEpisodes) {
      console.log("MegaPlay/MegaCloud completion received. Auto-advancing player into Episode " + nextEp);
      setEpisode(nextEp);
    }
  }
});

// Update launchVideoPlayer hook to route MegaPlay requests natively via AniList ID parameter routing maps
function launchVideoPlayer(epNum) {
  currentEpisodeIndex = epNum;
  updateEpisodeButtonsUI();

  const iframeContainer = document.getElementById("player-iframe-wrapper");
  const nativeContainer = document.getElementById("native-player-wrapper");
  const fallbackNotice = document.getElementById("player-empty-fallback-notice");

  if (iframeContainer) iframeContainer.classList.add("hidden");
  if (nativeContainer) nativeContainer.classList.add("hidden");
  if (fallbackNotice) fallbackNotice.classList.add("hidden");

  // Destroy legacy native media players safely
  if (window.currentPlyr) { window.currentPlyr.destroy(); window.currentPlyr = null; }
  if (window.currentHlsInstance) { window.currentHlsInstance.destroy(); window.currentHlsInstance = null; }

  if (activeProviderMode === 'megaplay') {
    if (!window.currentAnilistId) {
      if (fallbackNotice) fallbackNotice.classList.remove("hidden");
      return;
    }
    if (iframeContainer) {
      iframeContainer.classList.remove("hidden");
      const targetLang = currentLanguage === 'dub' ? 'dub' : 'sub';
      // Build MegaPlay's AniList numerical identifier mapping URL structure
      const streamUrl = `https://megaplay.buzz/stream/ani/${window.currentAnilistId}/${epNum}/${targetLang}`;
      iframeContainer.innerHTML = `<iframe src="${streamUrl}" width="100%" height="100%" frameborder="0" scrolling="no" allowfullscreen class="w-full h-full rounded-xl"></iframe>`;
    }
    return;
  }

  // Handle standard JSON/M3U8 response streaming logic for older legacy models
  // [Insert existing fallback / API fetch streams logic here as defined originally down inside your layout]
}
