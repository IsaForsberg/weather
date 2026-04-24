

  import { API_KEY } from './config.js';


 // Bas-URL till OpenWeathers API
  const BASE_URL = 'https://api.openweathermap.org';
 

  const searchInput      = document.getElementById('cityInput');
  const suggestionsList  = document.getElementById('suggestions');
  const errorMessage     = document.getElementById('errorMsg');
  const loadingSpinner   = document.getElementById('loader');
  const weatherCard      = document.getElementById('weatherCard');
  const apiKeyNotice     = document.getElementById('apiNotice');
 
  // Visa en varning om API-nyckeln inte är ifylld
  if (!API_KEY || API_KEY === 'DIN_API_NYCKEL_HÄR') {
    apiKeyNotice.classList.add('show');
  }
 
 
  // ════════════════════════════════════════════════════
  //  DEBOUNCE – vänta lite innan sökning körs
  // ════════════════════════════════════════════════════
  // Problemet: om vi söker på varje bokstav skickas massor av anrop.
  // Lösningen: vänta tills användaren slutat skriva i 280ms, sök sedan.
  //
  // functionToRun  = den funktion vi vill fördröja (t.ex. fetchSuggestions)
  // waitMillis     = hur många millisekunder vi väntar
  let debounceTimer = null;
 
  function debounce(functionToRun, waitMillis) {
    return function(...arguments_) {
      // Avbryt den tidigare timern varje gång funktionen anropas
      clearTimeout(debounceTimer);
      // Starta en ny timer – om den inte avbryts körs funktionen när tiden löpt ut
      debounceTimer = setTimeout(() => functionToRun(...arguments_), waitMillis);
    };
  }
 
 
  // ════════════════════════════════════════════════════
  //  AUTOCOMPLETE – stadsförslag medan man skriver
  // ════════════════════════════════════════════════════
 
  // Håller koll på vilken rad i dropdown-listan som är markerad med tangentbordet
  let activeRowIndex = -1;  // -1 betyder att ingen rad är markerad
 
  // Sparar listan med stadsförslag som kom från API:t
  let currentCitySuggestions = [];
 
  // Hämtar stadsförslag från OpenWeathers Geo API baserat på det man skrivit
  async function fetchSuggestions(searchText) {
    // Gör ingenting om texten är för kort
    if (!searchText || searchText.length < 2) {
      closeSuggestions();
      return;
    }
    try {
      // Skicka ett anrop till Geo API:t med söktexten
      // encodeURIComponent gör om specialtecken (t.ex. å ä ö) till URL-säkra tecken
      const response = await fetch(
        `${BASE_URL}/geo/1.0/direct?q=${encodeURIComponent(searchText)}&limit=3&appid=${API_KEY}`
      );
      if (!response.ok) throw new Error();
 
      // Omvandla svaret från JSON-format till ett JavaScript-objekt vi kan använda
      const cityList = await response.json();
 
      // Spara listan globalt så att selectSuggestion kan använda den
      currentCitySuggestions = cityList;
 
      // Bygg och visa dropdown-listan
      renderSuggestions(cityList);
 
    } catch {
      // Om något gick fel, stäng bara listan tyst
      closeSuggestions();
    }
  }
 
  // Omvandlar en landskod som "SE" till en emoji-flagga 🇸🇪
  // Tricket: varje bokstav i koden omvandlas till en unicode-regionssymbol
  // "global" i replace(/./g) betyder "byt ut VARJE bokstav", inte bara den första
  function countryCodeToFlag(countryCode) {
    if (!countryCode) return '';
    return countryCode.toUpperCase().replace(/./g, letter =>
      String.fromCodePoint(letter.codePointAt(0) + 127397)
    );
  }
 
  // Bygger HTML för dropdown-listan och stoppar in den i suggestions-elementet
  function renderSuggestions(cityList) {
    if (!cityList.length) {
      closeSuggestions();
      return;
    }
 
    // Nollställ markerad rad
    activeRowIndex = -1;
 
    // Bygg en HTML-sträng med en rad per stad och stoppa in den i dropdown-elementet
    suggestionsList.innerHTML = cityList.map((city, index) => `
      <div class="suggestion-item" data-index="${index}">
        <span class="flag">${countryCodeToFlag(city.country)}</span>
        <span class="loc-name">${city.name}${city.state ? ', ' + city.state : ''}</span>
        <span class="loc-country">${city.country || ''}</span>
      </div>
    `).join('');
 
    // Gör listan synlig (CSS reagerar på klassen "open")
    suggestionsList.classList.add('open');
 
    // Lägg till en klick-lyssnare på varje rad i listan
    suggestionsList.querySelectorAll('.suggestion-item').forEach(rowElement => {
      rowElement.addEventListener('mousedown', clickEvent => {
        // preventDefault hindrar att sökfältet tappar fokus innan klicket registreras
        clickEvent.preventDefault();
        selectSuggestion(parseInt(rowElement.dataset.index));
      });
    });
  }
 
  // Stänger och rensar dropdown-listan
  function closeSuggestions() {
    suggestionsList.classList.remove('open');
    suggestionsList.innerHTML = '';
    activeRowIndex = -1;
    currentCitySuggestions = [];
  }
 
  // Kallas när användaren klickar eller trycker Enter på ett förslag i listan
  function selectSuggestion(index) {
    const selectedCity = currentCitySuggestions[index];
    if (!selectedCity) return;
 
    // Fyll i sökfältet med stadens fullständiga namn
    searchInput.value = selectedCity.name
      + (selectedCity.state ? `, ${selectedCity.state}` : '')
      + `, ${selectedCity.country}`;
 
    // Stäng listan
    closeSuggestions();
 
    // Hämta väderdata direkt med koordinaterna vi redan har från Geo API:t
    // Det sparar ett extra anrop jämfört med att söka på namn igen
    fetchWeather(selectedCity.lat, selectedCity.lon, selectedCity.name, selectedCity.country);
  }
 
 
  // ════════════════════════════════════════════════════
  //  TANGENTBORDSNAVIGERING i dropdown-listan
  // ════════════════════════════════════════════════════
 
  // Lyssnar på tangenttryckningar när sökfältet är aktivt
  searchInput.addEventListener('keydown', keyboardEvent => {
    const allRows = suggestionsList.querySelectorAll('.suggestion-item');
 
    if (keyboardEvent.key === 'ArrowDown') {
      // Pil ned: flytta markeringen ett steg ner, men inte förbi sista raden
      keyboardEvent.preventDefault();
      activeRowIndex = Math.min(activeRowIndex + 1, allRows.length - 1);
      highlightActiveRow(allRows);
 
    } else if (keyboardEvent.key === 'ArrowUp') {
      // Pil upp: flytta markeringen ett steg upp, men inte förbi första raden
      keyboardEvent.preventDefault();
      activeRowIndex = Math.max(activeRowIndex - 1, 0);
      highlightActiveRow(allRows);
 
    } else if (keyboardEvent.key === 'Enter') {
      // Enter: välj den markerade raden, eller sök på det man skrivit om ingen rad är markerad
      keyboardEvent.preventDefault();
      if (activeRowIndex >= 0) {
        selectSuggestion(activeRowIndex);
      } else if (searchInput.value.trim()) {
        closeSuggestions();
        searchByName(searchInput.value.trim());
      }
 
    } else if (keyboardEvent.key === 'Escape') {
      // Escape: stäng listan
      closeSuggestions();
    }
  });
 
  // Uppdaterar vilken rad i listan som ser markerad ut (blå bakgrund)
  function highlightActiveRow(allRows) {
    // Loopa igenom alla rader och lägg till/ta bort klassen "active"
    allRows.forEach((rowElement, index) => {
      rowElement.classList.toggle('active', index === activeRowIndex);
    });
    // Scrolla så den markerade raden syns om listan är lång
    if (allRows[activeRowIndex]) {
      allRows[activeRowIndex].scrollIntoView({ block: 'nearest' });
    }
  }
 
  // Lyssna på ändringar i sökfältet och hämta förslag (via debounce)
  searchInput.addEventListener('input', debounce(() => {
    fetchSuggestions(searchInput.value.trim());
  }, 280));
 
  // När sökfältet tappar fokus: stäng listan efter 150ms
  // Fördröjningen behövs så att ett klick på ett förslag hinner registreras först
  searchInput.addEventListener('blur', () => setTimeout(closeSuggestions, 150));
 
 
  // ════════════════════════════════════════════════════
  //  SÖK PÅ NAMN – fallback om man trycker Enter utan att välja förslag
  // ════════════════════════════════════════════════════
 
  async function searchByName(cityName) {
    showError(false);
    showLoadingSpinner(true);
    try {
      // Gör ett Geo API-anrop för att hitta koordinater för det inmatade namnet
      const response = await fetch(
        `${BASE_URL}/geo/1.0/direct?q=${encodeURIComponent(cityName)}&limit=1&appid=${API_KEY}`
      );
      if (!response.ok) throw new Error('Nätverksfel');
 
      const cityList = await response.json();
      if (!cityList.length) throw new Error(`Staden "${cityName}" hittades inte.`);
 
      // Plocka ut koordinater och namn från det första (och enda) resultatet
      const { lat, lon, name: foundCityName, country } = cityList[0];
 
      await fetchWeather(lat, lon, foundCityName, country);
 
    } catch (error) {
      showLoadingSpinner(false);
      showError(error.message || 'Något gick fel. Försök igen.');
    }
  }
 
 
  // ════════════════════════════════════════════════════
  //  HÄMTA VÄDERDATA – skickar API-anrop till OpenWeather
  // ════════════════════════════════════════════════════
 
  async function fetchWeather(latitude, longitude, cityName, countryCode) {
    showError(false);
    showLoadingSpinner(true);
    try {
      // Skicka två anrop SAMTIDIGT med Promise.all – ett för aktuellt väder, ett för prognos
      // Det går dubbelt så snabbt som att skicka dem ett i taget
      const [weatherResponse, forecastResponse] = await Promise.all([
        fetch(`${BASE_URL}/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${API_KEY}&units=metric&lang=sv`),
        fetch(`${BASE_URL}/data/2.5/forecast?lat=${latitude}&lon=${longitude}&appid=${API_KEY}&units=metric&lang=sv`)
      ]);
 
      // Kontrollera att väder-anropet gick bra
      if (!weatherResponse.ok) {
        const errorBody = await weatherResponse.json().catch(() => ({}));
        throw new Error(errorBody.message || `Fel ${weatherResponse.status}`);
      }
 
      // Omvandla båda svaren från JSON till JavaScript-objekt
      const weatherData   = await weatherResponse.json();
      const forecastData  = forecastResponse.ok ? await forecastResponse.json() : null;
 
      // Skicka datan till renderfunktionerna som stoppar in värdena i HTML:en
      renderWeather(weatherData, cityName, countryCode);
      if (forecastData) renderForecast(forecastData.list);
 
    } catch (error) {
      showError(error.message || 'Kunde inte hämta väderdata.');
    } finally {
      // "finally" körs alltid oavsett om det gick bra eller dåligt
      showLoadingSpinner(false);
    }
  }
 
 
  // ════════════════════════════════════════════════════
  //  PROGNOS – filtrera och rendera 3 dagar framåt
  // ════════════════════════════════════════════════════
 
  // Forecast API:t returnerar ~40 tidpunkter (var 3:e timme i 5 dagar)
  // Den här funktionen plockar ut ett värde per dag, helst kl 12:00
  function getDailyForecasts(forecastList) {
    const datesAlreadySeen = new Set(); // Set är som en lista som inte tillåter dubbletter
 
    return forecastList.filter(forecastItem => {
      // dt_txt ser ut såhär: "2024-04-23 12:00:00"
      // split(' ') delar upp strängen vid mellanslaget → ["2024-04-23", "12:00:00"]
      // [0] plockar ut den första delen → "2024-04-23"
      const dateString = forecastItem.dt_txt.split(' ')[0];
 
      // Behåll bara poster som är kl 12:00 och vars datum vi inte sett förut
      if (!datesAlreadySeen.has(dateString) && forecastItem.dt_txt.includes('12:00:00')) {
        datesAlreadySeen.add(dateString);
        return true;
      }
      return false;
 
    // slice(0, 3) klipper ut de tre första elementen ur den filtrerade listan
    }).slice(0, 3);
  }
 
  // Bygger och visar de tre prognosdagarna i HTML:en
  function renderForecast(forecastList) {
    let threeDays = getDailyForecasts(forecastList);
 
    // Fallback: om vi inte fick tre 12:00-poster (t.ex. på grund av tidszon)
    // tar vi istället den första posten per dag och hoppar över dagens datum
    if (threeDays.length < 3) {
      const datesAlreadySeen = new Set();
      threeDays = forecastList.filter(forecastItem => {
        const dateString = forecastItem.dt_txt.split(' ')[0];
        if (!datesAlreadySeen.has(dateString)) {
          datesAlreadySeen.add(dateString);
          return true;
        }
        return false;
      }).slice(1, 4); // slice(1, 4) hoppar över index 0 (idag) och tar index 1–3
    }
 
    // Bygg HTML-kort för varje dag och stoppa in dem i forecastRow-elementet
    document.getElementById('forecastRow').innerHTML = threeDays.map(forecastDay => {
      // dt är tidpunkten som ett unix-tal (sekunder sedan 1970)
      // Multiplicera med 1000 för att få millisekunder som JavaScript's Date förväntar sig
      const dateObject  = new Date(forecastDay.dt * 1000);
      const dayName     = dateObject.toLocaleDateString('sv-SE', { weekday: 'short' }); // t.ex. "tis"
      const temperature = Math.round(forecastDay.main.temp);
      const iconCode    = forecastDay.weather[0].icon;
      const description = forecastDay.weather[0].description;
 
      return `
        <div class="forecast-box">
          <div class="forecast-day">${dayName}</div>
          <img src="https://openweathermap.org/img/wn/${iconCode}@2x.png" alt="${description}" />
          <div class="forecast-temp">${temperature}°</div>
          <div class="forecast-desc">${description}</div>
        </div>
      `;
    }).join(''); // join('') sätter ihop alla HTML-strängar till en enda stor sträng
  }
 
 
  // ════════════════════════════════════════════════════
  //  RENDERA VÄDERKORTET – stoppar in data i HTML-elementen
  // ════════════════════════════════════════════════════
 
  function renderWeather(weatherData, cityName, countryCode) {
    // Stoppa in varje värde i rätt HTML-element via textContent
    document.getElementById('cityDisplay').textContent     = cityName;
    document.getElementById('countryDisplay').textContent  = countryCode || '';
    document.getElementById('tempDisplay').textContent     = Math.round(weatherData.main.temp);
    document.getElementById('descDisplay').textContent     = weatherData.weather[0].description;
    document.getElementById('humidityDisplay').textContent = `${weatherData.main.humidity} %`;
 
    // Vinden från API:t kommer i meter per sekund – multiplicera med 3.6 för att få km/h
    document.getElementById('windDisplay').textContent     = `${Math.round(weatherData.wind.speed * 3.6)} km/h`;
    document.getElementById('pressureDisplay').textContent = `${weatherData.main.pressure} hPa`;
 
    // Sikten kommer i meter – dela med 1000 för att få km. toFixed(1) ger en decimal
    document.getElementById('visibilityDisplay').textContent =
      weatherData.visibility != null ? `${(weatherData.visibility / 1000).toFixed(1)} km` : '—';
 
    document.getElementById('feelsDisplay').textContent    = Math.round(weatherData.main.feels_like);
 
    // Väderikonen: bygg en img-tagg med rätt URL och stoppa in den med innerHTML
    const iconContainer = document.getElementById('iconWrap');
    const iconCode      = weatherData.weather[0].icon;
    iconContainer.innerHTML = `<img src="https://openweathermap.org/img/wn/${iconCode}@2x.png" alt="${weatherData.weather[0].description}" />`;
 
    // Visa klockslaget för när datan hämtades
    const rightNow = new Date();
    document.getElementById('updatedDisplay').textContent =
      `Uppdaterad ${rightNow.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`;
 
    // Visa väderkortet (CSS reagerar på klassen "show" och gör det synligt)
    weatherCard.classList.add('show');
    weatherCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
 
 
  // ════════════════════════════════════════════════════
  //  HJÄLPFUNKTIONER – visa/dölj spinnern och felmeddelanden
  // ════════════════════════════════════════════════════
 
  // Visar eller döljer laddningsspinnern
  // isVisible = true → visa spinnern och dölj väderkortet
  // isVisible = false → dölj spinnern
  function showLoadingSpinner(isVisible) {
    loadingSpinner.classList.toggle('show', isVisible);
    if (isVisible) weatherCard.classList.remove('show');
  }
 
  // Visar eller döljer felmeddelandet
  // errorText = en textsträng → visa meddelandet
  // errorText = false        → dölj meddelandet
  function showError(errorText) {
    if (errorText === false) {
      errorMessage.classList.remove('show');
    } else {
      errorMessage.textContent = errorText;
      errorMessage.classList.add('show');
    }
  }