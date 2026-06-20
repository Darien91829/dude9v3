const JIKAN_BASE = "https://api.jikan.moe/v4";

// YOUR STANDALONE STREAMING API HOSTED ON VERCEL
const ANIVEXA_BASE_API = "https://anivexa-api-eta.vercel.app";

let currentEpisodeIndex = 1;
let currentLanguage = 'sub';
let activeScheduleDay = 'today';
let activeProviderMode = 'allmanga'; // Default active provider

// Track all available backend providers from your API manifest (MegaPlay Added)
const API_PROVIDERS = [
  { id: 'allmanga', name: 'AllManga', status: 'Active' },
  { id: 'reanime', name: 'ReAnime', status: 'Active' },
  { id: 'anikoto', name: 'AniKoto', status: 'Active' },
  { id: 'animegg', name: 'AnimeGG', status: 'Active' },
  { id: 'anineko', name: 'AniNeko', status: 'Active' },
  { id: 'anidbapp', name: 'AniDB App', status: 'Active' },
  { id: 'animepahe', name: 'AnimePahe', status: 'Unstable' },
  { id: 'megaplay', name: 'MegaPlay', status: 'Active' }
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

// Character Color Configuration Presets Array (MegaPlay Theme Vector Added)
const presets = {
  umi: { hex: '#4169e1', rgb: '65, 105, 225', bg: '#090d16', card: '#111827', input: '#1f2937', textLight: true },
  alya: { hex: '#a1a1aa', rgb: '161, 161, 170', bg: '#111115', card: '#18181b', input: '#27272a', textLight: true },
  subaru: { hex: '#f97316', rgb: '249, 115, 22', bg: '#0f0f12', card: '#16161c', input: '#22222a', textLight: false },
  emilia: { hex: '#c084fc', rgb: '192, 132, 252', bg: '#0d0a12', card: '#14101c', input: '#1e182a', textLight: true },
  rem: { hex: '#38bdf8', rgb: '56, 189, 248', bg: '#090e14', card: '#101620', input: '#182230', textLight: false },
  ram: { hex: '#fb7185', rgb: '251, 113, 133', bg: '#140a0d', card: '#1f1014', input: '#2e181e', textLight: false },
  beatrice: { hex: '#fbbf24', rgb: '251, 191, 36', bg: '#14110a', card: '#1f1a10', input: '#2e2618', textLight: false },
  felt: { hex: '#eab308', rgb: '234, 179, 8', bg: '#12110a', card: '#1c1a10', input: '#2a2718', textLight: false },
  reinhard: { hex: '#dc2626', rgb: '220, 38, 38', bg: '#140a0a', card: '#1f1010', input: '#301818', textLight: true },
  crusch: { hex: '#059669', rgb: '5, 150, 105', bg: '#0a1410', card: '#101f1a', input: '#183027', textLight: true },
  felix: { hex: '#d97706', rgb: '217, 119, 6', bg: '#14100a', card: '#1f1810', input: '#302418', textLight: false },
  priscilla: { hex: '#ef4444', rgb: '239, 68, 68', bg: '#140a0a', card: '#1f1010', input: '#301818', textLight: true },
  anastasia: { hex: '#f472b6', rgb: '244, 114, 182', bg: '#140a11', card: '#1f101a', input: '#301828', textLight: false },
  julius: { hex: '#6366f1', rgb: '99, 102, 241', bg: '#0b0b14', card: '#11111f', input: '#1b1b30', textLight: true },
  wilhelm: { hex: '#94a3b8', rgb: '148, 163, 184', bg: '#0f1115', card: '#17191e', input: '#22252c', textLight: false },
  roswaal: { hex: '#4f46e5', rgb: '79, 70, 229', bg: '#0a0a14', card: '#10101f', input: '#181830', textLight: true },
  satella: { hex: '#6d28d9', rgb: '109, 40, 217', bg: '#0a0812', card: '#100c1c', input: '#18122a', textLight: true },
  echidna: { hex: '#e2e8f0', rgb: '226, 232, 240', bg: '#111113', card: '#19191c', input: '#242429', textLight: false },
  megaplay: { hex: '#00ffff', rgb: '0, 255, 255', bg: '#081212', card: '#0e1c1c', input: '#152b2b', textLight: false }
};

document.addEventListener("DOMContentLoaded", () => {
  syncCurrentClockTime();
  setInterval(syncCurrentClockTime, 1000);
  applyCharacterPreset('umi');
  switchToView('home');
  buildLocalWatchlistGridContainer();
});

function syncCurrentClockTime() {
  const clockEl = document.getElementById("live-24h-clock");
  if (!clockEl) return;
  const targetTime = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  clockEl.innerText = targetTime.toTimeString().split(' ')[0] + " JST";
}

function switchToView(viewId) {
  const views = ['landing-portal', 'main-exploration-hub', 'releases-focus-view', 'calendar-focus-view', 'stream-dashboard-box'];
  views.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  const headerSearch = document.getElementById('header-search-engine');
  const viewTitle = document.getElementById('view-indicator-title');

  if (viewId === 'home') {
    document.getElementById('landing-portal').classList.remove('hidden');
    document.getElementById('main-exploration-hub').classList.remove('hidden');
    if (headerSearch) headerSearch.classList.add('hidden');
    if (viewTitle) viewTitle.innerText = "Welcome Portal";
    if (!hubFeedsLoaded) { loadHubFeedsData(); hubFeedsLoaded = true; }
  } else if (viewId === 'catalog') {
    document.getElementById('main-exploration-hub').classList.remove('hidden');
    if (headerSearch) headerSearch.classList.remove('hidden');
    if (viewTitle) viewTitle.innerText = "Catalog Index Hub";
    if (!hubFeedsLoaded) { loadHubFeedsData(); hubFeedsLoaded = true; }
  } else if (viewId === 'releases') {
    document.getElementById('releases-focus-view').classList.remove('hidden');
    if (headerSearch) headerSearch.classList.remove('hidden');
    if (viewTitle) viewTitle.innerText = "Seasonal Releases Database";
    if (!recentReleasesLoaded) { fetchRecentReleasesGrid(); recentReleasesLoaded = true; }
  } else if (viewId === 'calendar') {
    document.getElementById('calendar-focus-view').classList.remove('hidden');
    if (headerSearch) headerSearch.classList.remove('hidden');
    if (viewTitle) viewTitle.innerText = "Airing Track Grid Matrix";
    if (!calendarLoaded) { initCalendarViewEngine(); calendarLoaded = true; }
  } else if (viewId === 'stream') {
    document.getElementById('stream-dashboard-box').classList.remove('hidden');
    if (headerSearch) headerSearch.classList.remove('hidden');
    if (viewTitle) viewTitle.innerText = "Dynamic Node Stream Dashboard";
  }

  const navItems = {
    'home': 'side-nav-home',
    'catalog': 'side-nav-catalog',
    'releases': 'side-nav-releases',
    'calendar': 'side-nav-calendar'
  };

  Object.keys(navItems).forEach(key => {
    const btn = document.getElementById(navItems[key]);
    if (!btn) return;
    if (key === viewId || (viewId === 'catalog' && key === 'catalog')) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  applyCharacterPreset(currentPresetName);
  closeMainMenu();
}

function triggerCatalogSearch(fromHeader) {
  const query = fromHeader ? document.getElementById('header-search-input').value : document.getElementById('search-input').value;
  if (!query.trim()) return;

  if (fromHeader) {
    document.getElementById('search-input').value = query;
  } else {
    document.getElementById('header-search-input').value = query;
  }

  switchToView('catalog');
  const title = document.getElementById('grid-header-title');
  if (title) title.innerText = `Search Results for: "${query}"`;

  const resultsGrid = document.getElementById('results-grid');
  resultsGrid.innerHTML = `<p class="text-xs text-gray-500 font-mono col-span-full"><i class="fa-solid fa-circle-notch animate-spin mr-1"></i>Running catalog lookup query...</p>`;

  fetch(`${JIKAN_BASE}/anime?q=${encodeURIComponent(query)}&limit=24`)
    .then(res => res.json())
    .then(data => {
      renderAnimeCards(data.data || [], resultsGrid);
    })
    .catch(err => {
      console.error(err);
      resultsGrid.innerHTML = `<p class="text-xs text-red-500 font-mono col-span-full">Failed to query catalog databases.</p>`;
    });
}

function loadHubFeedsData() {
  const resultsGrid = document.getElementById('results-grid');
  fetch(`${JIKAN_BASE}/top/anime?filter=bypopularity&limit=12`)
    .then(res => res.json())
    .then(data => renderAnimeCards(data.data || [], resultsGrid))
    .catch(err => console.error(err));

  const recScroller = document.getElementById('recommendations-scroller');
  fetch(`${JIKAN_BASE}/seasons/now?limit=10`)
    .then(res => res.json())
    .then(data => {
      recScroller.innerHTML = '';
      const list = data.data || [];
      if (!list.length) {
        recScroller.innerHTML = `<p class="text-xs text-gray-500 font-mono">No highlights matched tracking tags.</p>`;
        return;
      }
      list.forEach(anime => {
        const div = document.createElement('div');
        div.className = "min-w-[140px] w-[140px] bg-dark-card border border-dark-border rounded-xl overflow-hidden shadow-lg shrink-0 cursor-pointer transition-all hover:scale-[1.02]";
        div.onclick = () => fetchAnimeMetadataIdentity(anime.mal_id);
        div.innerHTML = `
          <div class="aspect-[3/4] bg-neutral-900 relative">
            <img src="${anime.images?.jpg?.image_url}" class="w-full h-full object-cover" loading="lazy" alt="Cover">
            <div class="absolute bottom-1 right-1 bg-black/80 px-1.5 py-0.5 rounded text-[9px] font-bold text-accent dynamic-accent-text font-mono">${anime.score ? '★ ' + anime.score : 'N/A'}</div>
          </div>
          <div class="p-2 leading-tight">
            <p class="text-[11px] font-bold text-white truncate">${anime.title}</p>
            <p class="text-[9px] text-gray-500 truncate mt-0.5">${anime.type || 'TV'} · ${anime.episodes || '?'} Ep</p>
          </div>
        `;
        recScroller.appendChild(div);
      });
      applyCharacterPreset(currentPresetName);
    })
    .catch(err => console.error(err));

  fetchScheduleSideList('today');
  fetchTopChartHotlist();
}

function fetchScheduleSideList(day) {
  const box = document.getElementById('schedule-box');
  box.innerHTML = `<p class="text-[11px] text-gray-500 text-center py-4 font-mono"><i class="fa-solid fa-circle-notch animate-spin mr-1"></i>Syncing day array...</p>`;
  
  const jicanDaysMap = { 'yesterday': 'sunday', 'today': 'monday', 'tomorrow': 'tuesday' };
  const targetDay = jicanDaysMap[day] || 'monday';

  fetch(`${JIKAN_BASE}/schedules?filter=${targetDay}&limit=15`)
    .then(res => res.json())
    .then(data => {
      box.innerHTML = '';
      const list = data.data || [];
      if (!list.length) {
        box.innerHTML = `<p class="text-xs text-gray-600 text-center py-4">No tracks running on this vector timeline.</p>`;
        return;
      }
      list.forEach(item => {
        const row = document.createElement('div');
        row.className = "flex items-center justify-between p-2 rounded-xl bg-dark-input/40 border border-dark-border/40 hover:bg-neutral-900/40 transition-colors text-[11px] cursor-pointer";
        row.onclick = () => fetchAnimeMetadataIdentity(item.mal_id);
        row.innerHTML = `
          <div class="flex items-center space-x-2.5 min-w-0 flex-1 pr-2">
            <span class="w-1.5 h-1.5 rounded-full bg-accent dynamic-accent-bg shrink-0"></span>
            <p class="font-medium text-gray-300 truncate">${item.title}</p>
          </div>
          <span class="font-mono text-[10px] text-gray-500 shrink-0 bg-neutral-900 px-1.5 py-0.5 rounded border border-dark-border/60">${item.broadcast?.time || 'N/A'}</span>
        `;
        box.appendChild(row);
      });
      applyCharacterPreset(currentPresetName);
    })
    .catch(err => {
      console.error(err);
      box.innerHTML = `<p class="text-xs text-red-500 text-center py-4">Timeline failed.</p>`;
    });
}

function changeScheduleDay(day) {
  activeScheduleDay = day;
  ['yesterday', 'today', 'tomorrow'].forEach(d => {
    const btn = document.getElementById(`tab-${d}`);
    if (btn) {
      if (d === day) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }
  });
  fetchScheduleSideList(day);
}

function fetchTopChartHotlist() {
  const box = document.getElementById('top10-box');
  fetch(`${JIKAN_BASE}/top/anime?filter=upcoming&limit=5`)
    .then(res => res.json())
    .then(data => {
      box.innerHTML = '';
      const list = data.data || [];
      list.forEach((item, idx) => {
        const card = document.createElement('div');
        card.className = "flex items-center space-x-3 p-1.5 rounded-xl hover:bg-neutral-900/30 transition-colors cursor-pointer";
        card.onclick = () => fetchAnimeMetadataIdentity(item.mal_id);
        card.innerHTML = `
          <span class="font-black text-sm italic text-gray-600 w-4 text-center">${idx + 1}</span>
          <div class="w-9 aspect-[2/3] bg-neutral-900 rounded-md overflow-hidden shrink-0">
            <img src="${item.images?.jpg?.small_image_url}" class="w-full h-full object-cover" alt="Thumb">
          </div>
          <div class="min-w-0 flex-1 leading-tight">
            <p class="text-xs font-bold text-gray-200 truncate">${item.title}</p>
            <p class="text-[10px] text-gray-500 truncate mt-0.5">${item.source || 'Manga'} · Members: ${item.members?.toLocaleString() || '0'}</p>
          </div>
        `;
        box.appendChild(card);
      });
    })
    .catch(err => console.error(err));
}

function fetchRecentReleasesGrid() {
  const grid = document.getElementById('releases-api-grid');
  grid.innerHTML = `<p class="text-xs text-gray-500 font-mono col-span-full"><i class="fa-solid fa-circle-notch animate-spin mr-1"></i>Syncing seasonal releases timeline...</p>`;
  
  fetch(`${JIKAN_BASE}/seasons/now?limit=25`)
    .then(res => res.json())
    .then(data => {
      renderAnimeCards(data.data || [], grid);
    })
    .catch(err => {
      console.error(err);
      grid.innerHTML = `<p class="text-xs text-red-500 font-mono col-span-full">Failed to compile recent episodic records.</p>`;
    });
}

function initCalendarViewEngine() {
  const matrix = document.getElementById('calendar-days-matrix');
  matrix.innerHTML = '';
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  days.forEach(day => {
    const btn = document.createElement('button');
    btn.className = `calendar-matrix-day p-2 rounded-xl border text-[11px] uppercase tracking-wide font-bold font-mono transition-all`;
    btn.id = `cal-matrix-${day}`;
    btn.innerText = day.substring(0, 3);
    btn.onclick = () => selectCalendarDayFilter(day);
    matrix.appendChild(btn);
  });

  const currentDayIndex = new Date().getDay(); 
  const jsDaysMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const realTodayName = jsDaysMap[currentDayIndex];
  
  const todayBtn = document.getElementById(`cal-matrix-${realTodayName}`);
  if (todayBtn) todayBtn.classList.add('active-today');

  selectCalendarDayFilter(realTodayName);
}

function selectCalendarDayFilter(day) {
  selectedDayFilter = day;
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  days.forEach(d => {
    const btn = document.getElementById(`cal-matrix-${d}`);
    if (btn) btn.classList.remove('selected-filter');
  });

  const activeBtn = document.getElementById(`cal-matrix-${day}`);
  if (activeBtn) activeBtn.classList.add('selected-filter');

  const listContainer = document.getElementById('airing-chronological-list');
  listContainer.innerHTML = `<p class="text-xs text-gray-500 font-mono col-span-full"><i class="fa-solid fa-circle-notch animate-spin mr-1"></i>Compiling chronological data array strings...</p>`;

  fetch(`${JIKAN_BASE}/schedules?filter=${day}`)
    .then(res => res.json())
    .then(data => {
      window.currentCalendarCache = data.data || [];
      filterCalendarGrid();
    })
    .catch(err => {
      console.error(err);
      listContainer.innerHTML = `<p class="text-xs text-red-500 font-mono col-span-full">Matrix schedule call isolated with errors.</p>`;
    });
}

function filterCalendarGrid() {
  const query = document.getElementById('calendar-search').value.toLowerCase().trim();
  const listContainer = document.getElementById('airing-chronological-list');
  
  if (!window.currentCalendarCache) return;
  
  const items = window.currentCalendarCache.filter(item => {
    return item.title.toLowerCase().includes(query);
  });

  renderAnimeCards(items, listContainer);
}

function resetCalendarGridDay() {
  document.getElementById('calendar-search').value = '';
  const currentDayIndex = new Date().getDay();
  const jsDaysMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  selectCalendarDayFilter(jsDaysMap[currentDayIndex]);
}

function renderAnimeCards(list, container) {
  container.innerHTML = '';
  if (!list.length) {
    container.innerHTML = `<p class="text-xs text-gray-600 font-mono col-span-full py-6 text-center">No structural array objects found matching parameters.</p>`;
    return;
  }
  
  list.forEach(anime => {
    const isInWatchlist = checkIfWatchlistItemExists(anime.mal_id);
    const card = document.createElement('div');
    card.className = "bg-dark-card border border-dark-border rounded-2xl overflow-hidden shadow-xl flex flex-col justify-between transition-all duration-200 hover:scale-[1.015] relative group";
    card.innerHTML = `
      <div onclick="fetchAnimeMetadataIdentity(${anime.mal_id})" class="aspect-[3/4] bg-neutral-900 w-full relative overflow-hidden cursor-pointer">
        <img src="${anime.images?.jpg?.image_url}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" alt="Cover">
        <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-3 flex flex-col justify-between">
          <div class="flex justify-end">
            <span class="bg-black/70 text-white font-mono text-[9px] px-2 py-0.5 rounded border border-white/10 font-bold uppercase">${anime.type || 'TV'}</span>
          </div>
          <p class="text-[10px] text-gray-300 leading-snug line-clamp-3">${anime.synopsis || 'No synopsis log compiled in records yet.'}</p>
        </div>
        <div class="absolute bottom-2 left-2 bg-black/80 px-2 py-0.5 rounded-md text-[10px] font-bold font-mono tracking-wide text-accent dynamic-accent-text border border-dark-border/40">${anime.score ? '★ ' + anime.score : '★ N/A'}</div>
      </div>
      <div class="p-3 space-y-2 flex-1 flex flex-col justify-between">
        <div onclick="fetchAnimeMetadataIdentity(${anime.mal_id})" class="cursor-pointer">
          <h3 class="text-xs font-bold text-white line-clamp-1 group-hover:text-accent group-hover:dynamic-accent-text transition-colors">${anime.title}</h3>
          <p class="text-[10px] text-gray-500 truncate mt-0.5 font-mono">${anime.episodes || '?'} Episodes · ${anime.duration?.split(' per')[0] || 'Unknown length'}</p>
        </div>
        <div class="flex items-center gap-1.5 pt-1 border-t border-dark-border/40">
          <button onclick="toggleWatchlistItemAction(${anime.mal_id}, '${escapeJsonString(anime.title)}', '${anime.images?.jpg?.small_image_url || anime.images?.jpg?.image_url}')" class="flex-1 bg-dark-input hover:bg-neutral-900 border border-dark-border hover:border-gray-700 p-2 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center justify-center space-x-1.5 text-gray-400 hover:text-white transition-colors" title="Save to Watchlist">
            <i class="${isInWatchlist ? 'fa-solid fa-bookmark text-accent dynamic-accent-text' : 'fa-regular fa-bookmark'}"></i>
            <span>${isInWatchlist ? 'Saved' : 'Watchlist'}</span>
          </button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
  
  applyCharacterPreset(currentPresetName);
}

function fetchAnimeMetadataIdentity(malId) {
  switchToView('stream');
  window.currentMalId = malId;

  const titleEl = document.getElementById('detail-title');
  const posterEl = document.getElementById('detail-poster');
  const synEl = document.getElementById('detail-synopsis');
  const typeEl = document.getElementById('detail-type');
  const epEl = document.getElementById('detail-episodes');
  const ratEl = document.getElementById('detail-rating');
  const providerGrid = document.getElementById('sub-server-links-grid');
  const epButtonsBox = document.getElementById('episode-buttons');

  titleEl.innerText = "Syncing Core Metadata...";
  posterEl.src = "";
  synEl.innerText = "Compiling data tracks...";
  typeEl.innerText = "--";
  epEl.innerText = "--";
  ratEl.innerText = "--";
  providerGrid.innerHTML = '';
  epButtonsBox.innerHTML = '';

  fetch(`${JIKAN_BASE}/anime/${malId}`)
    .then(res => res.json())
    .then(resData => {
      const anime = resData.data;
      if (!anime) return;

      titleEl.innerText = anime.title;
      posterEl.src = anime.images?.jpg?.image_url;
      synEl.innerText = anime.synopsis || "No data synopsis recorded.";
      typeEl.innerText = anime.type || "TV";
      epEl.innerText = anime.episodes || "Ongoing";
      ratEl.innerText = anime.score || "N/A";

      queryAnivexaMappingDatabase(anime.title);
    })
    .catch(err => {
      console.error(err);
      titleEl.innerText = "Error tracking Jikan records Node.";
    });
}

function queryAnivexaMappingDatabase(titleString) {
  const providerGrid = document.getElementById('sub-server-links-grid');
  providerGrid.innerHTML = `
    <div class="bg-dark-card border border-dark-border rounded-2xl p-4 shadow-xl space-y-3 animate-fade-in">
      <div class="flex flex-wrap items-center justify-between border-b border-dark-border/60 pb-2.5 gap-2">
        <span class="text-[10px] font-bold text-gray-500 uppercase tracking-wider font-mono">Unified Server Provider Nodes</span>
        <span id="active-provider-badge" class="text-[9px] uppercase tracking-widest font-black px-2 py-0.5 rounded bg-accent/10 border border-accent/20 text-accent dynamic-accent-text font-mono">allmanga</span>
      </div>
      <div id="provider-tabs-row-render" class="flex flex-wrap gap-1.5"></div>
    </div>
  `;

  renderProviderButtonsUI();

  fetch(`${ANIVEXA_BASE_API}/api/search?q=${encodeURIComponent(titleString)}`)
    .then(res => res.json())
    .then(mapResult => {
      globalEpisodeDataCache = mapResult;
      currentEpisodeIndex = 1;
      compileEpisodeButtonsEngine();
    })
    .catch(err => {
      console.error(err);
      document.getElementById('episode-buttons').innerHTML = `<p class="text-xs text-red-400 font-mono py-2">Mapping payload structure failed initialization.</p>`;
    });
}

function renderProviderButtonsUI() {
  const row = document.getElementById('provider-tabs-row-render');
  if (!row) return;
  row.innerHTML = '';

  const currentActiveHex = document.querySelector('.dynamic-accent-text')?.style.color || '#f97316';
  const curPreset = presets[currentPresetName] || presets.subaru;

  API_PROVIDERS.forEach(prov => {
    const btn = document.createElement('button');
    btn.className = `server-tab-btn px-3 py-1.5 rounded-xl border font-bold text-[10px] uppercase tracking-wider transition-all duration-150`;
    btn.innerText = prov.name;
    
    if (activeProviderMode === prov.id) {
      btn.style.backgroundColor = currentActiveHex;
      btn.style.color = curPreset.textLight ? '#ffffff' : '#000000';
      btn.style.borderColor = currentActiveHex;
    } else {
      btn.style.backgroundColor = '';
      btn.style.color = '';
      btn.style.borderColor = '';
    }

    btn.onclick = () => {
      activeProviderMode = prov.id;
      const badge = document.getElementById('active-provider-badge');
      if (badge) badge.innerText = prov.id;
      renderProviderButtonsUI();
      compileEpisodeButtonsEngine();
    };

    row.appendChild(btn);
  });
}

function compileEpisodeButtonsEngine() {
  const container = document.getElementById('episode-buttons');
  container.innerHTML = '';

  if (!globalEpisodeDataCache || !globalEpisodeDataCache[activeProviderMode]) {
    container.innerHTML = `<p class="text-xs text-gray-600 font-mono py-2">No matching tracks on selected Provider cluster.</p>`;
    document.getElementById('video-iframe').src = '';
    return;
  }

  const dataset = globalEpisodeDataCache[activeProviderMode];
  const listKeys = Object.keys(dataset).map(Number).sort((a, b) => a - b);

  if (!listKeys.length) {
    container.innerHTML = `<p class="text-xs text-gray-600 font-mono py-2">Mapped episode array matches empty structures.</p>`;
    return;
  }

  listKeys.forEach(epNum => {
    const btn = document.createElement('button');
    btn.id = `ep-node-btn-${epNum}`;
    btn.className = `w-10 h-10 rounded-xl font-bold font-mono text-xs flex items-center justify-center border transition-all duration-150`;
    btn.innerText = epNum;
    
    btn.onclick = () => {
      currentEpisodeIndex = epNum;
      updateEpisodeButtonsUI();
      launchVideoPlayer(epNum);
    };

    container.appendChild(btn);
  });

  if (!listKeys.includes(currentEpisodeIndex)) {
    currentEpisodeIndex = listKeys[0];
  }

  updateEpisodeButtonsUI();
  launchVideoPlayer(currentEpisodeIndex);
}

function updateEpisodeButtonsUI() {
  if (!globalEpisodeDataCache || !globalEpisodeDataCache[activeProviderMode]) return;
  const dataset = globalEpisodeDataCache[activeProviderMode];
  const listKeys = Object.keys(dataset).map(Number);

  const currentActiveHex = document.querySelector('.dynamic-accent-text')?.style.color || '#f97316';
  const curPreset = presets[currentPresetName] || presets.subaru;

  listKeys.forEach(epNum => {
    const btn = document.getElementById(`ep-node-btn-${epNum}`);
    if (!btn) return;

    if (epNum === currentEpisodeIndex) {
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

let streamLoadGuard = null;

function launchVideoPlayer(epNum) {
  clearTimeout(streamLoadGuard);
  const iframe = document.getElementById('video-iframe');
  const epTitle = document.getElementById('ep-title');

  epTitle.innerText = `Watching: Episode ${epNum} [${currentLanguage.toUpperCase()}]`;

  removeActiveNoticeOverlayStructure();

  if (!globalEpisodeDataCache || !globalEpisodeDataCache[activeProviderMode] || !globalEpisodeDataCache[activeProviderMode][epNum]) {
    handleStreamMissingNotice();
    return;
  }

  const epTargetObject = globalEpisodeDataCache[activeProviderMode][epNum];
  let finalEmbedUrl = "";

  if (currentLanguage === 'dub' && epTargetObject.dub) {
    finalEmbedUrl = epTargetObject.dub;
  } else {
    finalEmbedUrl = epTargetObject.sub || epTargetObject.dub || "";
  }

  if (!finalEmbedUrl) {
    handleStreamMissingNotice();
    return;
  }

  iframe.src = finalEmbedUrl;

  streamLoadGuard = setTimeout(() => {
    console.log("Embed signature monitor expired. Verifying context container status safely.");
  }, 7000);
}

function handleStreamMissingNotice() {
  const box = document.getElementById('player-box');
  removeActiveNoticeOverlayStructure();

  const overlay = document.createElement('div');
  overlay.id = "stream-missing-notice-overlay";
  overlay.className = "absolute inset-0 bg-neutral-950/95 flex flex-col items-center justify-center p-6 text-center z-10 animate-fade-in";
  overlay.innerHTML = `
    <div class="max-w-xs space-y-3">
      <i class="fa-solid fa-triangle-exclamation text-amber-500 text-3xl"></i>
      <h4 class="text-xs font-bold uppercase tracking-wider text-white">Stream Configuration Void</h4>
      <p class="text-[11px] text-gray-500 leading-relaxed font-mono">Source empty on provider: "${activeProviderMode.toUpperCase()}". Try switching tabs above.</p>
    </div>
  `;
  box.appendChild(overlay);
  document.getElementById('video-iframe').src = '';
}

function removeActiveNoticeOverlayStructure() {
  const overlay = document.getElementById('stream-missing-notice-overlay');
  if (overlay) overlay.remove();
}

function homeReturnReset() {
  document.getElementById('search-input').value = '';
  document.getElementById('header-search-input').value = '';
  const title = document.getElementById('grid-header-title');
  if (title) title.innerText = "Trending Media Records";
  loadHubFeedsData();
  switchToView('home');
}

function openBottomSheet() {
  const sheet = document.getElementById('bottom-sheet-menu');
  const overlay = document.getElementById('sheet-overlay');
  if (sheet && overlay) {
    overlay.classList.remove('hidden');
    setTimeout(() => sheet.classList.remove('translate-y-full'), 10);
  }
}

function closeBottomSheet() {
  const sheet = document.getElementById('bottom-sheet-menu');
  const overlay = document.getElementById('sheet-overlay');
  if (sheet && overlay) {
    sheet.classList.add('translate-y-full');
    setTimeout(() => overlay.classList.add('hidden'), 300);
  }
}

function toggleMainMenu() {
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

function closeMainMenu() {
  document.getElementById('main-menu-drawer').classList.add('-translate-x-full');
  document.getElementById('menu-overlay').classList.add('hidden');
}

function applyCharacterPreset(name) {
  const p = presets[name];
  if (!p) return;
  currentPresetName = name;

  // Structural Canvas Tokens Set
  document.body.style.backgroundColor = p.bg;
  
  const drawer = document.getElementById('main-menu-drawer');
  if (drawer) drawer.style.backgroundColor = p.bg;

  document.querySelectorAll('.bg-dark-card').forEach(el => el.style.backgroundColor = p.card);
  document.querySelectorAll('.bg-dark-input').forEach(el => el.style.backgroundColor = p.input);
  document.querySelectorAll('.border-dark-border').forEach(el => el.style.borderColor = p.input);

  // Root Variable Lift for Neon Accent Glow Tracers
  document.documentElement.style.setProperty('--character-accent', p.hex);
  document.documentElement.style.setProperty('--character-accent-rgb', p.rgb);

  // Script Explicit Processing Hooks Injection
  document.querySelectorAll('.dynamic-accent-text').forEach(el => el.style.color = p.hex);
  document.querySelectorAll('.dynamic-accent-bg').forEach(el => {
    el.style.backgroundColor = p.hex;
    el.style.color = p.textLight ? '#ffffff' : '#000000';
  });

  // Re-indexing interface elements properties mapping elements
  renderProviderButtonsUI();
  updateEpisodeButtonsUI();
  updateLanguageButtonsUI();

  // Highlight Active Calendar Day Block Framework Checks
  document.querySelectorAll('.calendar-matrix-day').forEach(el => {
    if (el.classList.contains('selected-filter')) {
      el.style.backgroundColor = p.hex;
      el.style.color = p.textLight ? '#ffffff' : '#000000';
      el.style.borderColor = p.hex;
    } else {
      el.style.backgroundColor = '';
      el.style.color = '';
      el.style.borderColor = '';
    }
  });
}

function getLocalWatchlistArray() {
  try {
    return JSON.parse(localStorage.getItem('the_dude9_watchlist')) || [];
  } catch (e) {
    return [];
  }
}

function checkIfWatchlistItemExists(malId) {
  const list = getLocalWatchlistArray();
  return list.some(x => x.id === malId);
}

function toggleWatchlistItemAction(malId, titleStr, imgUrl) {
  let list = getLocalWatchlistArray();
  const idx = list.findIndex(x => x.id === malId);
  
  if (idx > -1) {
    list.splice(idx, 1);
  } else {
    list.push({ id: malId, title: titleStr, image: imgUrl });
  }
  
  localStorage.setItem('the_dude9_watchlist', JSON.stringify(list));
  buildLocalWatchlistGridContainer();
  
  // Dynamic matrix rebuild to show state checks on catalog grids instantly
  const activeView = ['home', 'catalog', 'releases', 'calendar'].find(v => {
    const nav = document.getElementById(`side-nav-${v}`);
    return nav && nav.classList.contains('active');
  }) || 'home';
  
  if (activeView === 'home' || activeView === 'catalog') {
    const resultsGrid = document.getElementById('results-grid');
    if(resultsGrid && window.currentCalendarCache) {} 
  }
}

function buildLocalWatchlistGridContainer() {
  const wrapper = document.getElementById('watchlist-wrapper-section');
  const container = document.getElementById('my-watchlist-grid');
  if (!container || !wrapper) return;

  const list = getLocalWatchlistArray();
  if (!list.length) {
    wrapper.classList.add('hidden');
    container.innerHTML = '';
    return;
  }

  wrapper.classList.remove('hidden');
  container.innerHTML = '';

  list.forEach(item => {
    const div = document.createElement('div');
    div.className = "flex items-center justify-between p-1.5 rounded-xl bg-dark-card border border-dark-border/40 hover:border-gray-800 transition-colors group text-xs";
    div.innerHTML = `
      <div onclick="fetchAnimeMetadataIdentity(${item.id})" class="flex items-center space-x-2.5 min-w-0 flex-1 cursor-pointer">
        <div class="w-7 aspect-[2/3] bg-neutral-900 rounded overflow-hidden shrink-0">
          <img src="${item.image}" class="w-full h-full object-cover" alt="Cover">
        </div>
        <p class="font-medium text-gray-300 truncate group-hover:text-white">${item.title}</p>
      </div>
      <button onclick="toggleWatchlistItemAction(${item.id}, '', ''); event.stopPropagation();" class="text-gray-600 hover:text-red-400 p-1.5 shrink-0 transition-colors" title="Delete record node">
        <i class="fa-solid fa-trash-can text-[10px]"></i>
      </button>
    `;
    container.appendChild(div);
  });
}

function escapeJsonString(str) {
  if (!str) return '';
  return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function updateLanguageButtonsUI() {
  const subBtn = document.getElementById('sub-btn');
  const dubBtn = document.getElementById('dub-btn');
  if (!subBtn || !dubBtn) return;

  const currentAccentColor = document.querySelector('.dynamic-accent-text')?.style.color || '#f97316';
  const curPreset = presets[currentPresetName] || presets.subaru;
  const activeTextColor = curPreset.textLight ? '#ffffff' : '#000000';

  if (currentLanguage === 'sub') {
    subBtn.className = "px-3.5 py-1 text-xs font-bold rounded-lg transition-all bg-accent text-black lang-btn active";
    subBtn.style.backgroundColor = currentAccentColor;
    subBtn.style.color = activeTextColor;

    dubBtn.className = "px-3.5 py-1 text-xs font-bold text-gray-500 rounded-lg transition-all lang-btn";
    dubBtn.style.backgroundColor = '';
    dubBtn.style.color = '';
  } else {
    subBtn.className = "px-3.5 py-1 text-xs font-bold text-gray-500 rounded-lg transition-all lang-btn";
    subBtn.style.backgroundColor = '';
    subBtn.style.color = '';

    dubBtn.className = "px-3.5 py-1 text-xs font-bold rounded-lg transition-all bg-accent text-black lang-btn active";
    dubBtn.style.backgroundColor = currentAccentColor;
    dubBtn.style.color = activeTextColor;
  }
}

// Autoplay Handshake Interceptor
window.addEventListener("message", function (event) {
  let data = event.data;
  if (typeof data === "string") { try { data = JSON.parse(data); } catch (e) { return; } }
  if (data && (data.event === "complete" || data.event === "ended" || data.status === "finished")) {
    const nextEp = currentEpisodeIndex + 1;
    if (globalEpisodeDataCache && globalEpisodeDataCache[activeProviderMode] && globalEpisodeDataCache[activeProviderMode][nextEp]) {
      currentEpisodeIndex = nextEp;
      updateEpisodeButtonsUI();
      launchVideoPlayer(nextEp);
    }
  }
});
