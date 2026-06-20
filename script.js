const JIKAN_BASE = "https://api.jikan.moe/v4";
const ANIVEXA_BASE_API = "https://anivexa-api-eta.vercel.app";

let currentEpisodeIndex = 1;
let currentLanguage = 'sub';
let activeScheduleDay = 'today';
let activeProviderMode = 'allmanga'; 

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

let hubFeedsLoaded = false;
let recentReleasesLoaded = false;
let calendarLoaded = false;
let currentPresetName = 'subaru';
let selectedDayFilter = '';
let globalEpisodeDataCache = null;

window.currentAnilistId = null;
window.currentMalId = null;
window.activeAnimeTitle = "";
window.activeMaxEpisodes = 12;
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

function applyCharacterPreset(name) {
  const p = presets[name]; if (!p) return;
  currentPresetName = name;
  
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
}

function updateProviderButtonsUI() {
  const container = document.getElementById('sub-server-links-grid');
  if (!container) return;
  container.innerHTML = '';

  const currentAccentColor = document.querySelector('.dynamic-accent-text')?.style.color || '#00ff66';
  const curPreset = presets[currentPresetName] || presets.subaru;
  const activeTextColor = curPreset.textLight ? '#ffffff' : '#000000';

  API_PROVIDERS.forEach(prov => {
    const btn = document.createElement('button');
    btn.className = "px-3.5 py-1.5 text-xs font-semibold rounded-xl border border-dark-border transition-all";
    btn.innerText = prov.name;
    btn.id = `prov-btn-${prov.id}`;

    if (activeProviderMode === prov.id) {
      btn.style.backgroundColor = currentAccentColor;
      btn.style.borderColor = currentAccentColor;
      btn.style.color = activeTextColor;
    } else {
      btn.className += " bg-dark-input text-gray-400 hover:text-white";
    }

    btn.onclick = () => {
      activeProviderMode = prov.id;
      updateProviderButtonsUI();
      launchVideoPlayer(currentEpisodeIndex);
    };
    container.appendChild(btn);
  });
}

function updateLanguageButtonsUI() {
  const currentAccentColor = document.querySelector('.dynamic-accent-text')?.style.color || '#00ff66';
  const curPreset = presets[currentPresetName] || presets.subaru;
  const activeTextColor = curPreset.textLight ? '#ffffff' : '#000000';

  ['sub', 'dub'].forEach(l => {
    const btn = document.getElementById(`${l}-btn`);
    if (!btn) return;
    if (currentLanguage === l) {
      btn.className = "px-3.5 py-1 text-xs font-bold rounded-lg transition-all lang-btn active";
      btn.style.backgroundColor = currentAccentColor;
      btn.style.color = activeTextColor;
    } else {
      btn.className = "px-3.5 py-1 text-xs font-bold text-gray-500 rounded-lg transition-all lang-btn";
      btn.style.backgroundColor = '';
      btn.style.color = '';
    }
  });
}

function updateEpisodeButtonsUI() {
  const container = document.getElementById('episode-buttons');
  if (!container) return;
  container.innerHTML = '';

  const currentAccentColor = document.querySelector('.dynamic-accent-text')?.style.color || '#00ff66';
  const curPreset = presets[currentPresetName] || presets.subaru;
  const activeTextColor = curPreset.textLight ? '#ffffff' : '#000000';

  for (let i = 1; i <= window.activeMaxEpisodes; i++) {
    const btn = document.createElement('button');
    btn.className = "w-10 h-10 text-xs font-bold rounded-xl border border-dark-border transition-all flex items-center justify-center";
    btn.innerText = i;

    if (currentEpisodeIndex === i) {
      btn.style.backgroundColor = currentAccentColor;
      btn.style.borderColor = currentAccentColor;
      btn.style.color = activeTextColor;
    } else {
      btn.className += " bg-dark-input text-gray-400 hover:text-white";
    }

    btn.onclick = () => {
      currentEpisodeIndex = i;
      updateEpisodeButtonsUI();
      launchVideoPlayer(i);
    };
    container.appendChild(btn);
  }
}

function launchVideoPlayer(epNum) {
  currentEpisodeIndex = epNum;
  updateEpisodeButtonsUI();
  updateLanguageButtonsUI();

  const iframeContainer = document.getElementById("player-iframe-wrapper");
  const nativeContainer = document.getElementById("native-player-wrapper");
  const fallbackNotice = document.getElementById("player-empty-fallback-notice");
  const iframeEl = document.getElementById("video-iframe");

  if (iframeContainer) iframeContainer.classList.add("hidden");
  if (nativeContainer) nativeContainer.classList.add("hidden");
  if (fallbackNotice) fallbackNotice.classList.add("hidden");
  if (iframeEl) iframeEl.src = "";

  if (window.currentPlyr) { window.currentPlyr.destroy(); window.currentPlyr = null; }
  if (window.currentHlsInstance) { window.currentHlsInstance.destroy(); window.currentHlsInstance = null; }

  const targetLang = currentLanguage === 'dub' ? 'dub' : 'sub';

  if (activeProviderMode === 'megaplay') {
    if (!window.currentAnilistId) {
      if (fallbackNotice) fallbackNotice.classList.remove("hidden");
      return;
    }
    if (iframeContainer && iframeEl) {
      iframeContainer.classList.remove("hidden");
      iframeEl.src = `https://megaplay.buzz/stream/ani/${window.currentAnilistId}/${epNum}/${targetLang}`;
    }
    return;
  }

  // Legacy dynamic server requests
  if (iframeContainer && iframeEl) {
    iframeContainer.classList.remove("hidden");
    iframeEl.src = `${ANIVEXA_BASE_API}/api/stream?id=${window.currentAnilistId}&ep=${epNum}&lang=${targetLang}&provider=${activeProviderMode}`;
  }
}

async function loadStreamingLayout(anilistId, malId, title) {
  window.currentAnilistId = anilistId;
  window.currentMalId = malId;
  window.activeAnimeTitle = title;
  
  document.getElementById('landing-portal').classList.add('hidden');
  document.getElementById('main-exploration-hub').classList.add('hidden');
  document.getElementById('releases-focus-view').classList.add('hidden');
  document.getElementById('calendar-focus-view').classList.add('hidden');
  document.getElementById('stream-dashboard-box').classList.remove('hidden');

  document.getElementById('detail-title').innerText = title;
  document.getElementById('ep-title').innerText = `Watching: ${title}`;

  // Pull operational track meta parameters via fallback hooks
  try {
    const meta = await fetch(`${JIKAN_BASE}/anime/${malId}`).then(res => res.json());
    if (meta.data) {
      window.activeMaxEpisodes = meta.data.episodes || 12;
      document.getElementById('detail-poster').src = meta.data.images?.jpg?.large_image_url || '';
      document.getElementById('detail-synopsis').innerText = meta.data.synopsis || 'No background description tracks.';
      document.getElementById('detail-type').innerText = meta.data.type || 'TV';
      document.getElementById('detail-episodes').innerText = window.activeMaxEpisodes;
      document.getElementById('detail-rating').innerText = meta.data.score || 'N/A';
    }
  } catch (e) {
    window.activeMaxEpisodes = 12;
  }

  updateProviderButtonsUI();
  launchVideoPlayer(1);
}

function switchToView(view) {
  const views = ['landing-portal', 'main-exploration-hub', 'releases-focus-view', 'calendar-focus-view', 'stream-dashboard-box'];
  views.forEach(v => {
    const el = document.getElementById(v);
    if (el) el.classList.add('hidden');
  });

  document.getElementById('header-search-engine').classList.remove('hidden');

  if (view === 'home') {
    document.getElementById('landing-portal').classList.remove('hidden');
    document.getElementById('main-exploration-hub').classList.remove('hidden');
    if (!hubFeedsLoaded) loadExplorationHubData();
  } else if (view === 'catalog') {
    document.getElementById('main-exploration-hub').classList.remove('hidden');
    if (!hubFeedsLoaded) loadExplorationHubData();
  } else if (view === 'releases') {
    document.getElementById('releases-focus-view').classList.remove('hidden');
    loadSeasonalReleases();
  } else if (view === 'calendar') {
    document.getElementById('calendar-focus-view').classList.remove('hidden');
    if (!calendarLoaded) initCalendarUI();
  }
  
  // Highlight navigation item controls matches
  document.querySelectorAll('.sidebar-item').forEach(item => item.classList.remove('active'));
  const activeNav = document.getElementById(`side-nav-${view}`);
  if (activeNav) activeNav.classList.add('active');
}

async function loadExplorationHubData() {
  hubFeedsLoaded = true;
  try {
    const trending = await fetch(`${JIKAN_BASE}/top/anime?filter=airing&limit=12`).then(res => res.json());
    const grid = document.getElementById('results-grid');
    if (grid && trending.data) {
      grid.innerHTML = '';
      trending.data.forEach(anime => {
        grid.innerHTML += `
          <div onclick="loadStreamingLayout(null, ${anime.mal_id}, '${anime.title.replace(/'/g, "\\'")}')" class="bg-dark-card border border-dark-border rounded-xl p-2.5 cursor-pointer hover:border-accent/40 transition-all">
            <img src="${anime.images?.jpg?.large_image_url}" class="w-full aspect-[3/4] object-cover rounded-lg mb-2">
            <h3 class="text-xs font-semibold truncate text-gray-200">${anime.title}</h3>
          </div>`;
      });
    }
  } catch (e) { console.error(e); }
}

function setLanguage(lang) {
  currentLanguage = lang;
  launchVideoPlayer(currentEpisodeIndex);
}

function toggleMainMenu() {
  const drawer = document.getElementById('main-menu-drawer');
  const overlay = document.getElementById('menu-overlay');
  drawer.classList.toggle('-translate-x-full');
  overlay.classList.toggle('hidden');
}

function openBottomSheet() {
  const sheet = document.getElementById('bottom-sheet-menu');
  const overlay = document.getElementById('sheet-overlay');
  sheet.classList.remove('translate-y-full');
  overlay.classList.remove('hidden');
}

function closeBottomSheet() {
  const sheet = document.getElementById('bottom-sheet-menu');
  const overlay = document.getElementById('sheet-overlay');
  sheet.classList.add('translate-y-full');
  overlay.classList.add('hidden');
}

window.addEventListener("message", function (event) {
  let data = event.data;
  if (typeof data === "string") { try { data = JSON.parse(data); } catch (e) { return; } }
  if (data && (data.event === "complete" || data.event === "ended" || data.status === "finished")) {
    const nextEp = currentEpisodeIndex + 1;
    if (nextEp <= window.activeMaxEpisodes) {
      launchVideoPlayer(nextEp);
    }
  }
});

// Trigger setup on component boot window attachment cycle
window.onload = () => {
  switchToView('home');
};
