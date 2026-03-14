let announcementData = [];
let activeTag = "All";

// Define your image paths here
const iconPaths = {
    play: "../icons/play.svg",
    pause: "../icons/pause.svg",
    restart: "../icons/restart.svg",
    download: "../icons/download.svg"
};

const formatTime = (s) => isNaN(s) ? "0:00" : `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`;

async function init() {
    try {
        const response = await fetch('data.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        announcementData = await response.json();
        
        renderTags();
        renderAnnouncements(announcementData);
    } catch (e) {
        console.error("Error loading JSON:", e);
        document.getElementById('announcement-list').innerHTML = 
            `<p style="padding:20px; color:red;">Error: ${e.message}</p>`;
    }
}

function renderTags() {
    const tagContainer = document.getElementById('filter-tags');
    const allTags = new Set(["All"]);
    announcementData.forEach(item => item.tags.forEach(t => allTags.add(t)));
    
    tagContainer.innerHTML = Array.from(allTags).map(tag => 
        `<span class="tag-filter ${tag === activeTag ? 'active' : ''}" data-tag="${tag}">${tag}</span>`
    ).join('');

    tagContainer.querySelectorAll('.tag-filter').forEach(el => {
        el.addEventListener('click', () => {
            activeTag = el.dataset.tag;
            renderTags();
            handleSearch();
        });
    });
}

function renderAnnouncements(data) {
    const list = document.getElementById('announcement-list');
    list.innerHTML = data.length ? '' : '<p style="padding: 20px;">No results found.</p>';

    data.forEach(item => {
        const card = document.createElement('div');
        card.className = 'audio-card';
        card.innerHTML = `
            <div class="audio-info">
                <h2 class="audio-title">${item.title}</h2>
                <p class="transcript">"${item.transcript}"</p>
                <p class="notes">${item.notes}</p>
                <div>${item.tags.map(t => `<span class="tag-mini">${t}</span>`).join('')}</div>
            </div>
            <div class="custom-player">
                <div class="controls">
                    <button class="play-btn">
                        <img src="${iconPaths.play}" class="ctrl-icon" alt="Play">
                    </button>
                    <button class="restart-btn">
                        <img src="${iconPaths.restart}" class="ctrl-icon" alt="Restart">
                    </button>
                    <div class="player-mid">
                        <input type="range" class="progress-bar" value="0" max="100">
                        <span class="time-display">0:00 / 0:00</span>
                    </div>
                    <a href="${item.file}" download class="download-btn">
                        <img src="${iconPaths.download}" class="ctrl-icon" alt="Download">
                    </a>
                </div>
            </div>
        `;
        setupAudioLogic(card, item.file);
        list.appendChild(card);
    });
}

function setupAudioLogic(card, src) {
    const audio = new Audio(src);
    const playBtn = card.querySelector('.play-btn');
    const playImg = playBtn.querySelector('img');
    const restartBtn = card.querySelector('.restart-btn');
    const progress = card.querySelector('.progress-bar');
    const timeDisp = card.querySelector('.time-display');

    audio.addEventListener('loadedmetadata', () => {
        timeDisp.innerText = `0:00 / ${formatTime(audio.duration)}`;
    });

    playBtn.addEventListener('click', () => {
        if (audio.paused) {
            document.querySelectorAll('audio').forEach(a => {
                a.pause();
                const otherImg = a.parentElement?.querySelector('.play-btn img');
                if(otherImg) otherImg.src = iconPaths.play;
            });
            audio.play();
            playImg.src = iconPaths.pause;
        } else {
            audio.pause();
            playImg.src = iconPaths.play;
        }
    });

    restartBtn.addEventListener('click', () => {
        audio.currentTime = 0;
        audio.play();
        playImg.src = iconPaths.pause;
    });

    audio.addEventListener('timeupdate', () => {
        progress.value = (audio.currentTime / audio.duration) * 100 || 0;
        timeDisp.innerText = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
    });

    progress.addEventListener('input', () => {
        audio.currentTime = (progress.value / 100) * audio.duration;
    });

    audio.addEventListener('ended', () => { 
        playImg.src = iconPaths.play; 
    });
}

function handleSearch() {
    const query = document.getElementById('search-input').value.toLowerCase();
    const type = document.querySelector('input[name="search-type"]:checked').value;
    
    const filtered = announcementData.filter(item => {
        const matchTag = activeTag === "All" || item.tags.includes(activeTag);
        const matchText = item[type].toLowerCase().includes(query);
        return matchTag && matchText;
    });
    renderAnnouncements(filtered);
}

document.getElementById('search-input').addEventListener('input', handleSearch);
document.querySelectorAll('input[name="search-type"]').forEach(r => r.addEventListener('change', handleSearch));

init();
