

  import { API_KEY } from './config.js';


  const BASE = 'https://api.openweathermap.org';

  const input       = document.getElementById('cityInput');
  const suggestions = document.getElementById('suggestions');
  const errorMsg    = document.getElementById('errorMsg');
  const loader      = document.getElementById('loader');
  const card        = document.getElementById('weatherCard');
  const apiNotice   = document.getElementById('apiNotice');

  // Visa notice om nyckel saknas
  if (!API_KEY || API_KEY === 'DIN_API_NYCKEL_HÄR') {
    apiNotice.classList.add('show');
  }

  // ── Debounce ──
  let debTimer = null;
  function debounce(fn, delay) {
    return (...args) => {
      clearTimeout(debTimer);
      debTimer = setTimeout(() => fn(...args), delay);
    };
  }

  // ── Autocomplete (Geo API) ──
  let activeIndex = -1;
  let currentSuggestions = [];

  async function fetchSuggestions(query) {
    if (!query || query.length < 2) { closeSuggestions(); return; }
    try {
      const res = await fetch(
        `${BASE}/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=5&appid=${API_KEY}`
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      currentSuggestions = data;
      renderSuggestions(data);
    } catch { closeSuggestions(); }
  }

  function countryFlag(code) {
    if (!code) return '';
    return code.toUpperCase().replace(/./g, c =>
      String.fromCodePoint(c.codePointAt(0) + 127397)
    );
  }

  function renderSuggestions(list) {
    if (!list.length) { closeSuggestions(); return; }
    activeIndex = -1;
    suggestions.innerHTML = list.map((item, i) => `
      <div class="suggestion-item" data-index="${i}">
        <span class="flag">${countryFlag(item.country)}</span>
        <span class="loc-name">${item.name}${item.state ? ', '+item.state : ''}</span>
        <span class="loc-country">${item.country || ''}</span>
      </div>
    `).join('');
    suggestions.classList.add('open');
    suggestions.querySelectorAll('.suggestion-item').forEach(el => {
      el.addEventListener('mousedown', e => {
        e.preventDefault();
        selectSuggestion(parseInt(el.dataset.index));
      });
    });
  }

  function closeSuggestions() {
    suggestions.classList.remove('open');
    suggestions.innerHTML = '';
    activeIndex = -1;
    currentSuggestions = [];
  }

  function selectSuggestion(index) {
    const item = currentSuggestions[index];
    if (!item) return;
    input.value = item.name + (item.state ? `, ${item.state}` : '') + `, ${item.country}`;
    closeSuggestions();
    fetchWeather(item.lat, item.lon, item.name, item.country);
  }

  // ── Keyboard navigation ──
  input.addEventListener('keydown', e => {
    const items = suggestions.querySelectorAll('.suggestion-item');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, items.length - 1);
      updateActive(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      updateActive(items);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0) {
        selectSuggestion(activeIndex);
      } else if (input.value.trim()) {
        closeSuggestions();
        searchByName(input.value.trim());
      }
    } else if (e.key === 'Escape') {
      closeSuggestions();
    }
  });

  function updateActive(items) {
    items.forEach((el, i) => el.classList.toggle('active', i === activeIndex));
    if (items[activeIndex]) items[activeIndex].scrollIntoView({ block: 'nearest' });
  }

  input.addEventListener('input', debounce(() => {
    fetchSuggestions(input.value.trim());
  }, 280));

  input.addEventListener('blur', () => setTimeout(closeSuggestions, 150));

  // ── Sök via namn (fallback) ──
  async function searchByName(name) {
    showError(false);
    showLoader(true);
    try {
      const res = await fetch(
        `${BASE}/geo/1.0/direct?q=${encodeURIComponent(name)}&limit=1&appid=${API_KEY}`
      );
      if (!res.ok) throw new Error('Nätverksfel');
      const list = await res.json();
      if (!list.length) throw new Error(`Staden "${name}" hittades inte.`);
      const { lat, lon, name: cityName, country } = list[0];
      await fetchWeather(lat, lon, cityName, country);
    } catch (err) {
      showLoader(false);
      showError(err.message || 'Något gick fel. Försök igen.');
    }
  }

  // ── Väder-API ──
  async function fetchWeather(lat, lon, name, country) {
    showError(false);
    showLoader(true);
    try {
      const res = await fetch(
        `${BASE}/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=sv`
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Fel ${res.status}`);
      }
      const data = await res.json();
      renderWeather(data, name, country);
    } catch (err) {
      showError(err.message || 'Kunde inte hämta väderdata.');
    } finally {
      showLoader(false);
    }
  }

  // ── Rendera kort ──
  function renderWeather(d, name, country) {
    document.getElementById('cityDisplay').textContent    = name;
    document.getElementById('countryDisplay').textContent = country || '';
    document.getElementById('tempDisplay').textContent    = Math.round(d.main.temp);
    document.getElementById('descDisplay').textContent    = d.weather[0].description;
    document.getElementById('humidityDisplay').textContent = `${d.main.humidity} %`;
    document.getElementById('windDisplay').textContent    = `${Math.round(d.wind.speed * 3.6)} km/h`;
    document.getElementById('pressureDisplay').textContent = `${d.main.pressure} hPa`;
    document.getElementById('visibilityDisplay').textContent =
      d.visibility != null ? `${(d.visibility / 1000).toFixed(1)} km` : '—';
    document.getElementById('feelsDisplay').textContent   = Math.round(d.main.feels_like);

    // Ikon
    const iconWrap = document.getElementById('iconWrap');
    const code = d.weather[0].icon;
    iconWrap.innerHTML = `<img src="https://openweathermap.org/img/wn/${code}@2x.png" alt="${d.weather[0].description}" />`;

    // Tidsstämpel
    const now = new Date();
    document.getElementById('updatedDisplay').textContent =
      `Uppdaterad ${now.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`;

    card.classList.add('show');
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function showLoader(v) {
    loader.classList.toggle('show', v);
    if (v) card.classList.remove('show');
  }

  function showError(msgOrFalse) {
    if (msgOrFalse === false) {
      errorMsg.classList.remove('show');
    } else {
      errorMsg.textContent = msgOrFalse;
      errorMsg.classList.add('show');
    }
  }
