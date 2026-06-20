const JIKAN_BASE = "https://api.jikan.moe/v4";

// STANDALONE STREAMING API HOSTED ON VERCEL
const ANIVEXA_BASE_API = "https://anivexa-api-eta.vercel.app";

let currentEpisodeIndex = 1;
let currentLanguage = 'sub';
let activeScheduleDay = 'today';
let activeProviderMode = 'allmanga'; // Default active provider

// Track available backend providers from your API manifest
const API_PROVIDERS = [
  { id: 'allmanga', name: 'AllManga', status: 'Active' },
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

// Store global references to destroy during stream context switching
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
  echidna: { hex: '#e2e8f0', bg: '#101012', card: '#18181c', input: '#24242a', textLight: false }
};

// Helper to convert HEX to RGB
function hexToRgb(hex) {
  const bigint = parseInt(hex.replace('#', ''), 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `${r}, ${g}, ${b}`;
}

// Apply Character Accent Color Presets
function applyCharacterPreset(presetName) {
  const preset = presets[presetName];
  if (!preset) return;

  currentPresetName = presetName;
  const root = document.documentElement;
  
  // Set global CSS custom properties
  root.style.setProperty('--character-accent', preset.hex);
  root.style.setProperty('--character-accent-rgb', hexToRgb(preset.hex));
  
  // Update language switcher layouts to maintain visibility
  updateLanguageButtonsUI();
}

// Update UI Language Button Configurations
function updateLanguageButtonsUI() {
  const subBtn = document.getElementById('sub-btn');
  const dubBtn = document.getElementById('dub-btn');
  if (!subBtn || !dubBtn) return;

  const currentAccentColor = getComputedStyle(document.documentElement).getPropertyValue('--character-accent').trim() || '#00ff66';
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
  if (typeof data === "string") { 
    try { data = JSON.parse(data); } catch (e) { return; } 
  }
  if (data && (data.event === "complete" || data.event === "ended" || data.status === "finished")) {
    const nextEp = currentEpisodeIndex + 1;
    if (nextEp <= window.activeMaxEpisodes) {
      if (typeof window.launchVideoPlayer === "function") {
        window.launchVideoPlayer(nextEp);
      }
    }
  }
});
