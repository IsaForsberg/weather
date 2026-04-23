

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
  // "ta emot hur många argument som helst och samla dem i en array som heter ...args"
  let debTimer = null;
  function debounce(fnc, delay) {
    return (...args) => {
      clearTimeout(debTimer);
      debTimer = setTimeout(() => fnc(...args), delay);
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
    if (!code) return '';            //global,  Caracter
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
 
  // ── Keyboard navigation ──      event.key: "ArrowDown", "ArrowUp", "Enter", "Escape"
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
 
  //el = element i dropdown listan, i = index för det elementet, activeIndex = index för det som är markerat
  function updateActive(items) {
    items.forEach((el, i) => el.classList.toggle('active', i === activeIndex));
    if (items[activeIndex]) items[activeIndex].scrollIntoView({ block: 'nearest' });
  }
 
  
  //tid innan sökalternativ visas
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
      // Hämta aktuellt väder och prognos parallellt
      const [weatherRes, forecastRes] = await Promise.all([
        fetch(`${BASE}/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=sv`),
        fetch(`${BASE}/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=sv`)
      ]);
 
      if (!weatherRes.ok) {
        const err = await weatherRes.json().catch(() => ({}));
        throw new Error(err.message || `Fel ${weatherRes.status}`);
      }
 
      const data         = await weatherRes.json();
      const forecastData = forecastRes.ok ? await forecastRes.json() : null;
 
      renderWeather(data, name, country);
      if (forecastData) renderForecast(forecastData.list);
 
    } catch (err) {
      showError(err.message || 'Kunde inte hämta väderdata.');
    } finally {
      showLoader(false);
    }
  }
 
  // ── Plocka ut ett värde per dag (kl 12:00) ──
  function getDailyForecasts(list) {
    const seen = new Set();
    return list.filter(item => {
      const date = item.dt_txt.split(' ')[0]; // "2024-04-23"
      if (!seen.has(date) && item.dt_txt.includes('12:00:00')) {
        seen.add(date);
        return true;
      }
      return false;
    }).slice(0, 3);
  }
 
  // ── Rendera prognos-kort ──
  function renderForecast(list) {
    const days = getDailyForecasts(list);
    // Fallback om 12:00-poster saknas (t.ex. tidzon-offset): ta första per dag
    const fallback = (() => {
      if (days.length >= 3) return days;
      const seen = new Set();
      return list.filter(item => {
        const date = item.dt_txt.split(' ')[0];
        if (!seen.has(date)) { seen.add(date); return true; }
        return false;
      }).slice(1, 4); // hoppa över dagens datum
    })();
 
    document.getElementById('forecastRow').innerHTML = fallback.map(day => {
      const date    = new Date(day.dt * 1000);
      const dayName = date.toLocaleDateString('sv-SE', { weekday: 'short' }); // "tis"
      const temp    = Math.round(day.main.temp);
      const icon    = day.weather[0].icon;
      const desc    = day.weather[0].description;
      return `
        <div class="forecast-box">
          <div class="forecast-day">${dayName}</div>
          <img src="https://openweathermap.org/img/wn/${icon}@2x.png" alt="${desc}" />
          <div class="forecast-temp">${temp}°</div>
          <div class="forecast-desc">${desc}</div>
        </div>
      `;
    }).join('');
  }
 
  // ── Rendera kort ── d = data från API, name = stadens namn, country = land (kan vara undefined)
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
 
  //v = true/false
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
