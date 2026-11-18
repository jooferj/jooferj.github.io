// --- CONFIGURABLE DELAY VARIABLES ---
const SHOW_BEFORE_SECONDS = 15; 
const HIDE_AFTER_SECONDS = 15;  

// Parse URL Parameter for stop_id (e.g., index.html?stop=CC3_A)
const urlParams = new URLSearchParams(window.location.search);
let currentStopId = (urlParams.get('stop') || urlParams.get('stop_id') || 'CC3_A').trim();

// Global GTFS Data Store & Loading Flag
let gtfsData = {
  stops: {},
  stopTimes: [],
  trips: {},
  routes: {},
  calendar: {},
  calendarDates: [],
  stationsMap: {}
};
let isDataLoaded = false;

// Audio Announcement State Tracking
let lastPlayedTripId = null;
let currentAudio = null;

// Circle Line Station Sequence (CC4 to CC34) for Interchange Lookups
const cclLoop = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34];
const interchanges = new Set([4, 9, 10, 13, 15, 17, 19, 22, 29, 33, 34]);

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  loadGTFSData();
  setInterval(updateDisplay, 1000);
});

// Simple CSV Parser utility
function parseCSV(text) {
  const lines = text.split("\n");
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ''));
  const result = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const currentLine = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    const obj = {};
    headers.forEach((h, index) => {
      let val = currentLine[index] ? currentLine[index].trim().replace(/^"|"$/g, '') : "";
      obj[h] = val;
    });
    result.push(obj);
  }
  return result;
}

// Load GTFS Files from 'gtfs/' folder
async function loadGTFSData() {
  try {
    const [stopsRes, stopTimesRes, tripsRes, routesRes, calendarRes, stationsRes] = await Promise.all([
      fetch('gtfs/stops.txt'),
      fetch('gtfs/stop_times.txt'),
      fetch('gtfs/trips.txt'),
      fetch('gtfs/routes.txt'),
      fetch('gtfs/calendar.txt').catch(() => null),
      fetch('gtfs/stations.json').catch(() => null)
    ]);

    const stopsText = await stopsRes.text();
    const stopTimesText = await stopTimesRes.text();
    const tripsText = await tripsRes.text();
    const routesText = await routesRes.text();
    const calendarText = calendarRes ? await calendarRes.text() : null;
    const stationsText = stationsRes ? await stationsRes.text() : null;

    parseCSV(stopsText).forEach(s => {
      gtfsData.stops[s.stop_id] = s;
    });

    parseCSV(tripsText).forEach(t => {
      if (t.route_id === "CCL" || t.route_id.includes("CC")) {
        gtfsData.trips[t.trip_id] = t;
      }
    });

    gtfsData.stopTimes = parseCSV(stopTimesText);

    parseCSV(routesText).forEach(r => {
      gtfsData.routes[r.route_id] = r;
    });

    if (calendarText) {
      parseCSV(calendarText).forEach(c => {
        gtfsData.calendar[c.service_id] = c;
      });
    }

    if (stationsText) {
      gtfsData.stationsMap = JSON.parse(stationsText);
    }

    // Resolve platform code from stops data for the UI header label
    const stopInfo = gtfsData.stops[currentStopId];
    let platformCode = '?';
    if (stopInfo) {
      if (stopInfo.platform_code) {
        platformCode = stopInfo.platform_code;
      } else {
        const upperStopId = currentStopId.toUpperCase();
        if (upperStopId.includes('_')) {
          platformCode = upperStopId.split('_')[1];
        } else if (['A', 'B', 'C', 'D', '1', '2'].includes(upperStopId.slice(-1))) {
          platformCode = upperStopId.slice(-1);
        }
      }
    }

    const platformLabel = document.getElementById('platform-label');
    if (platformLabel) {
      platformLabel.textContent = `Platform ${platformCode}`;
    }

    isDataLoaded = true; 
    console.log("GTFS Data Loaded. Target Stop ID:", currentStopId);
    updateDisplay();
  } catch (error) {
    console.error("Error loading GTFS files. Ensure they are served via a local web server.", error);
  }
}

// Convert HH:MM:SS to total seconds from midnight
function timeToSeconds(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.split(':').map(Number);
  return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
}

// Format seconds to HH:MM:SS
function secondsToTime(totalSeconds) {
  const hrs = Math.floor(totalSeconds / 3600) % 24;
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// Helper to check if a service_id is active for a given Date
function isServiceActive(serviceId, dateObj) {
  const service = gtfsData.calendar[serviceId];
  if (!service) return true;

  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  const currentDateInt = parseInt(`${yyyy}${mm}${dd}`, 10);

  const startDateInt = parseInt(service.start_date, 10);
  const endDateInt = parseInt(service.end_date, 10);

  if (currentDateInt < startDateInt || currentDateInt > endDateInt) {
    return false;
  }

  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = days[dateObj.getDay()];
  return service[dayName] === '1';
}

// Helper to get the correct caplet filename using stations.json
function getCapletFilename(destinationName) {
  if (!destinationName) return '';
  const headsignUpper = destinationName.toUpperCase().trim();

  for (const [code, name] of Object.entries(gtfsData.stationsMap)) {
    const nameUpper = name.toUpperCase();
    if (nameUpper === headsignUpper || headsignUpper.includes(nameUpper) || nameUpper.includes(headsignUpper)) {
      return `${code}.svg`;
    }
  }
  return '';
}

// Helper to determine Clockwise or Anticlockwise based on station and platform rules
function getDirectionText(stationCode, platformCode) {
  const code = stationCode.toUpperCase();
  const plat = platformCode.toUpperCase();

  if (code === 'CC1') {
    return 'Anticlockwise';
  }
  if (code === 'CC33') {
    if (plat === 'C') return 'Anticlockwise';
    if (plat === 'D') return 'Clockwise';
  }
  if (code === 'CC34') {
    if (plat === 'D') return 'Anticlockwise';
    if (plat === 'B') return 'Clockwise';
  }

  if (plat === 'A' || plat === '1') return 'Anticlockwise';
  if (plat === 'B' || plat === '2') return 'Clockwise';

  return 'Anticlockwise';
}

// Extract station code and platform code from currentStopId
function parseStopId(stopId) {
  const upper = stopId.toUpperCase();
  let baseCode = upper.split('_')[0];
  let plat = 'A';

  if (upper.includes('_')) {
    plat = upper.split('_')[1];
  } else {
    const lastChar = upper.slice(-1);
    if (['A', 'B', 'C', 'D', '1', '2'].includes(lastChar)) {
      plat = lastChar;
      baseCode = upper.slice(0, -1);
    }
  }
  return { baseCode, plat };
}

// Find the next interchange station along the CCL ring in the given direction
function getNextInterchange(currentCodeStr, direction) {
  const num = parseInt(currentCodeStr.replace(/[^0-9]/g, ''), 10);
  if (isNaN(num) || num < 4 || num > 34) return null;

  let idx = cclLoop.indexOf(num);
  if (idx === -1) return null;

  let step = (direction === 'Clockwise') ? -1 : 1;
  let len = cclLoop.length;

  for (let i = 1; i < len; i++) {
    let nextIdx = (idx + step * i + len) % len;
    let nextNum = cclLoop[nextIdx];
    if (interchanges.has(nextNum)) {
      return `CC${nextNum}`;
    }
  }
  return null;
}

// Play PA announcement audio safely (does nothing if file is missing/not found)
function playArrivalAnnouncement(platform, directionText, isLoop, targetCode, tripId) {
  if (lastPlayedTripId === tripId) return;
  lastPlayedTripId = tripId;

  const dirCode = (directionText.toUpperCase() === 'CLOCKWISE') ? 'CW' : 'ACW';
  const typeCode = isLoop ? 'LOOP' : 'END';
  const filename = `pa/${platform.toUpperCase()} ${dirCode} ${typeCode} ${targetCode.toUpperCase()}.m4a`;

  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }

  const audio = new Audio();
  
  // If file cannot be found (404), catch error silently and do not play
  audio.onerror = () => {
    // File missing - do nothing
  };

  audio.src = filename;
  audio.play().catch(() => {
    // Suppress unhandled promise rejection if file is missing or browser blocks autoplay
  });

  currentAudio = audio;
}

// Main update tick
function updateDisplay() {
  const now = new Date();
  const currentSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  
  const clockEl = document.getElementById('system-clock');
  if (clockEl) {
    if (Math.floor(Date.now() / 4000) % 2 === 0) {
      clockEl.textContent = secondsToTime(currentSeconds);
    } else {
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      clockEl.textContent = `${yyyy}-${mm}-${dd}`;
    }
  }

  if (!isDataLoaded) return;

  if (!gtfsData.stops[currentStopId]) {
    renderTrainRow(1, null, currentSeconds);
    renderTrainRow(2, null, currentSeconds);
    
    const arrivingView = document.getElementById('view-arriving');
    const scheduleView = document.getElementById('view-schedule');
    if (arrivingView && scheduleView) {
      arrivingView.classList.add('hidden');
      scheduleView.classList.remove('hidden');
    }
    return;
  }

  const seenTrips = new Set();
  const seenArrivals = [];

  const upcomingTrains = gtfsData.stopTimes
    .filter(st => {
      const matchesStop = st.stop_id.toUpperCase() === currentStopId.toUpperCase();
      const arrSec = timeToSeconds(st.arrival_time);
      const trip = gtfsData.trips[st.trip_id];

      if (!matchesStop || !trip || arrSec < currentSeconds) return false;
      return isServiceActive(trip.service_id, now);
    })
    .map(st => {
      const arrSec = timeToSeconds(st.arrival_time);
      const trip = gtfsData.trips[st.trip_id];
      return {
        tripId: st.trip_id,
        headsign: trip ? trip.trip_headsign : "Marina Bay",
        arrivalSeconds: arrSec,
        etaMinutes: Math.ceil((arrSec - currentSeconds) / 60)
      };
    })
    .sort((a, b) => a.arrivalSeconds - b.arrivalSeconds)
    .filter(t => {
      if (seenTrips.has(t.tripId)) return false;
      seenTrips.add(t.tripId);

      const isDuplicate = seenArrivals.some(existing => 
        existing.headsign === t.headsign && Math.abs(existing.arrivalSeconds - t.arrivalSeconds) < 60
      );
      if (isDuplicate) return false;

      seenArrivals.push({ headsign: t.headsign, arrivalSeconds: t.arrivalSeconds });
      return true;
    });

  const filteredTrains = upcomingTrains.filter(t => (t.arrivalSeconds - currentSeconds) <= 420 && (t.arrivalSeconds - currentSeconds) >= 0);

  renderTrainRow(1, filteredTrains[0], currentSeconds);
  renderTrainRow(2, filteredTrains[1], currentSeconds);

  const arrivingView = document.getElementById('view-arriving');
  const scheduleView = document.getElementById('view-schedule');
  const arrDirEl = document.getElementById('arr-dir');

  if (arrivingView && scheduleView) {
    if (filteredTrains.length > 0) {
      const nextTrain = filteredTrains[0];
      const secondsUntilArrival = nextTrain.arrivalSeconds - currentSeconds;

      if (secondsUntilArrival <= SHOW_BEFORE_SECONDS && secondsUntilArrival >= -HIDE_AFTER_SECONDS) {
        arrivingView.classList.remove('hidden');
        scheduleView.classList.add('hidden');
        
        const { baseCode, plat } = parseStopId(currentStopId);
        const upperBase = baseCode.toUpperCase();
        const dirText = getDirectionText(baseCode, plat);

        let arrStationText = nextTrain.headsign;
        let arrCapletTarget = nextTrain.headsign;
        let arrPrefixText = 'ends at';
        let isLoop = false;
        let audioTargetCode = '';

        const headsignUpper = nextTrain.headsign.toUpperCase().trim();
        const isLoopHeadsign = (headsignUpper === 'CLOCKWISE' || headsignUpper === 'ANTICLOCKWISE');

        if (isLoopHeadsign && upperBase !== 'CC1' && upperBase !== 'CC2' && upperBase !== 'CC3') {
          const nextIntCode = getNextInterchange(upperBase, dirText);
          if (nextIntCode && gtfsData.stationsMap[nextIntCode]) {
            arrPrefixText = 'via';
            arrStationText = gtfsData.stationsMap[nextIntCode];
            arrCapletTarget = arrStationText;
            isLoop = true;
            audioTargetCode = nextIntCode;
          }
        } else {
          audioTargetCode = getCapletFilename(nextTrain.headsign).replace('.svg', '');
        }

        document.getElementById('arr-station').textContent = arrStationText;
        document.getElementById('arr-caplet').src = `caplets/${getCapletFilename(arrCapletTarget)}`;
        
        const prefixEl = document.getElementById('arr-prefix');
        if (prefixEl) prefixEl.textContent = arrPrefixText;
        
        if (arrDirEl) {
          arrDirEl.textContent = dirText;
          arrDirEl.classList.add('blink-yellow');
        }

        // Trigger PA Audio Announcement safely
        playArrivalAnnouncement(plat, dirText, isLoop, audioTargetCode, nextTrain.tripId);

      } else {
        arrivingView.classList.add('hidden');
        scheduleView.classList.remove('hidden');
        if (secondsUntilArrival < -HIDE_AFTER_SECONDS) {
          lastPlayedTripId = null;
        }
      }
    } else {
      arrivingView.classList.add('hidden');
      scheduleView.classList.remove('hidden');
    }
  }
}

function renderTrainRow(rowNum, trainData, currentSeconds) {
  const dirEl = document.getElementById(`train-${rowNum}-dir`);
  const stationEl = document.getElementById(`train-${rowNum}-station`);
  const etaNumEl = document.getElementById(`train-${rowNum}-eta`);
  const unitEl = document.getElementById(`train-${rowNum}-unit`);
  const prefixEl = document.getElementById(`train-${rowNum}-pin-prefix`) || document.getElementById(`train-${rowNum}-prefix`);
  const capletEl = document.getElementById(`train-${rowNum}-caplet`);
  const rowEl = document.getElementById(`train-${rowNum}`);

  if (!rowEl) return;
  rowEl.style.display = 'flex';

  if (!trainData) {
    if (dirEl) dirEl.textContent = '';
    if (stationEl) stationEl.textContent = '';
    if (etaNumEl) etaNumEl.textContent = '';
    if (prefixEl) prefixEl.textContent = '';
    if (unitEl) unitEl.textContent = '';
    if (capletEl) capletEl.src = '';
    return;
  }

  const diffSec = trainData.arrivalSeconds - currentSeconds;
  const etaMins = Math.max(1, Math.ceil(diffSec / 60));

  if (etaNumEl) etaNumEl.textContent = etaMins;
  
  if (unitEl) {
    unitEl.textContent = (etaMins === 1) ? 'min' : 'mins';
  }
  
  const { baseCode, plat } = parseStopId(currentStopId);
  const upperBase = baseCode.toUpperCase();
  const dirText = getDirectionText(baseCode, plat);
  if (dirEl) dirEl.textContent = dirText;

  let displayStation = trainData.headsign;
  let capletTarget = trainData.headsign;
  let prefixText = 'ends at';

  const headsignUpper = trainData.headsign.toUpperCase().trim();
  const isLoopHeadsign = (headsignUpper === 'CLOCKWISE' || headsignUpper === 'ANTICLOCKWISE');

  if (isLoopHeadsign && upperBase !== 'CC1' && upperBase !== 'CC2' && upperBase !== 'CC3') {
    const nextIntCode = getNextInterchange(upperBase, dirText);
    if (nextIntCode && gtfsData.stationsMap[nextIntCode]) {
      prefixText = 'via';
      displayStation = gtfsData.stationsMap[nextIntCode];
      capletTarget = displayStation;
    }
  }

  if (prefixEl) prefixEl.textContent = prefixText;
  if (stationEl) stationEl.textContent = displayStation;
  
  if (capletEl) {
    capletEl.src = `caplets/${getCapletFilename(capletTarget)}`;
  }
}