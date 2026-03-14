let announcementData = [];
let activeTag = "All";

// Helper to format time
const formatTime = (s) => isNaN(s) ? "0:00" : `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`;

async function init() {
    try {
        const response = await fetch('data.yaml');
        const yamlText = await response.text();
        announcementData = js-yaml.load(yamlText);
        
        renderTags();
        renderAnnouncements(announcementData);
    } catch (e) {
        console.error("Error loading YAML:", e);
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
                    <button class="play-btn"><img src="../icons/play.svg" class="ctrl-icon"></button>
                    <button class="restart-btn"><img src="../icons/restart.svg" class="ctrl-icon"></button>
                    <div class="player-mid">
                        <input type="range" class="progress-bar" value="0" max="100">
                        <span class="time-display">0:00 / 0:00</span>
                    </div>
                    <a href="${item.file}" download class="download-btn"><img src="../icons/download.svg" class="ctrl-icon"></a>
                </div>
            </div>
        `;
        setupAudio(card, item.file);
        list.appendChild(card);
    });
}

function setupAudio(card, src) {
    const audio = new Audio(src);
    const playBtn = card.querySelector('.play-btn');
    const playIcon = playBtn.querySelector('.ctrl-icon');
    const restartBtn = card.querySelector('.restart-btn');
    const progress = card.querySelector('.progress-bar');
    const timeDisp = card.querySelector('.time-display');

    audio.addEventListener('loadedmetadata', () => {
        timeDisp.innerText = `0:00 / ${formatTime(audio.duration)}`;
    });

    playBtn.addEventListener('click', () => {
        if (audio.paused) {
            // Stop other playing audio
            document.querySelectorAll('audio').forEach(a => {
                a.pause();
                const otherIcon = a.parentElement?.querySelector('.play-btn .ctrl-icon');
                if(otherIcon) otherIcon.src = "../icons/play.svg";
            });
            audio.play();
            playIcon.src = "../icons/pause.svg";
        } else {
            audio.pause();
            playIcon.src = "../icons/play.svg";
        }
    });

    restartBtn.addEventListener('click', () => {
        audio.currentTime = 0;
        audio.play();
        playIcon.src = "../icons/pause.svg";
    });

    audio.addEventListener('timeupdate', () => {
        progress.value = (audio.currentTime / audio.duration) * 100 || 0;
        timeDisp.innerText = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
    });

    progress.addEventListener('input', () => {
        audio.currentTime = (progress.value / 100) * audio.duration;
    });

    audio.addEventListener('ended', () => { playIcon.src = "../icons/play.svg"; });
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
