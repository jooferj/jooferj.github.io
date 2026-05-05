let announcementData = [];
let activeTag = "All";
let activeAudio = null;
let activePlayImg = null;
let modalAudioInstance = null;
let currentModalItem = null;

const iconPaths = {
    play: "../icons/play.svg",
    pause: "../icons/pause.svg",
    restart: "../icons/restart.svg",
    download: "../icons/download.svg"
};

const formatTime = (s) => isNaN(s) || !isFinite(s) ? "0:00" : `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`;

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

// --- SHARED PLAYBACK ENGINE ---
function attachPlayback(container, audioSrc) {
    const audio = new Audio(audioSrc);
    // Finds either main page combined btn or modal btn
    const playBtn = container.querySelector('.play-btn-combined, .play-btn-modal');
    const playImg = playBtn.querySelector('img');
    const progress = container.querySelector('.progress-bar, .modal-progress-bar');
    const timeDisp = container.querySelector('.time-display, .modal-time-display');

    playBtn.onclick = () => {
        // RESTART Logic: If this specific audio is already playing, restart it
        if (activeAudio === audio && !audio.paused) {
            audio.currentTime = 0;
            return;
        }

        // Global Stop: Pause any other audio currently playing elsewhere
        if (activeAudio && activeAudio !== audio) {
            activeAudio.pause();
            if (activePlayImg) activePlayImg.src = iconPaths.play;
        }

        // Toggle Play/Pause
        if (audio.paused) {
            audio.play();
            playImg.src = iconPaths.pause;
            activeAudio = audio;
            activePlayImg = playImg;
        } else {
            audio.pause();
            playImg.src = iconPaths.play;
        }
    };

    audio.addEventListener('timeupdate', () => {
        const curr = audio.currentTime;
        const dur = audio.duration;
        progress.value = (curr / dur) * 100 || 0;
        timeDisp.innerText = `${formatTime(curr)} / ${formatTime(dur)}`;
    });

    progress.oninput = () => {
        if (audio.duration) {
            audio.currentTime = (progress.value / 100) * audio.duration;
        }
    };

    audio.addEventListener('ended', () => {
        playImg.src = iconPaths.play;
    });

    return audio;
}

// --- MAIN PAGE RENDERING ---
function renderAnnouncements(data) {
    const list = document.getElementById('announcement-list');
    list.innerHTML = data.length ? '' : '<p style="padding: 20px;">No results found.</p>';

    data.forEach(item => {
        const card = document.createElement('div');
        card.className = 'audio-card';

        card.innerHTML = `
            <div class="audio-info">
                <h2 class="audio-title">${item.title}</h2>
                <div class="tags-row">${item.tags.map(t => `<span class="tag-mini">${t}</span>`).join('')}</div>
            </div>
            
            <button class="annc-show-more" onclick='openModal(${JSON.stringify(item).replace(/'/g, "&apos;")})'>
                Show More
            </button>

            <div class="custom-player">
                <div class="controls">
                    <button class="play-btn-combined">
                        <img src="${iconPaths.play}" class="ctrl-icon" alt="Play/Restart">
                    </button>
                    <div class="player-mid">
                        <input type="range" class="progress-bar" value="0" max="100" style="accent-color: var(--smrt-ccl-color);">
                        <span class="time-display">0:00 / 0:00</span>
                    </div>
                    <a href="${item.file}" download class="download-btn">
                        <img src="${iconPaths.download}" class="ctrl-icon" alt="Download">
                    </a>
                </div>
            </div>
        `;
        attachPlayback(card, item.file);
        list.appendChild(card);
    });
}

// --- MODAL LOGIC ---
function openModal(item) {
    currentModalItem = item;
    const modal = document.getElementById('infoModal');
    
    document.getElementById('modalTitle').innerText = item.title;
    document.getElementById('modalTags').innerHTML = item.tags.map(t => `<span class="tag-mini">${t}</span>`).join('');
    document.getElementById('modalDownload').href = item.file;
    
    switchTab('Description');

    // Clean up previous modal audio if it exists
    if (modalAudioInstance) {
        modalAudioInstance.pause();
        modalAudioInstance = null;
    }

    // Reuse the playback engine for the modal
    modalAudioInstance = attachPlayback(modal, item.file);

    modal.style.display = 'block';

    // Close logic
    const closeBtn = modal.querySelector('.close-button');
    const closeModal = () => {
        modal.style.display = 'none';
        if (modalAudioInstance) {
            modalAudioInstance.pause();
            modalAudioInstance = null;
        }
        if (activeAudio === modalAudioInstance) activeAudio = null;
    };

    closeBtn.onclick = closeModal;
    window.onclick = (event) => { if (event.target == modal) closeModal(); };
}

function switchTab(type) {
    const btns = document.querySelectorAll('.tab-button');
    const body = document.getElementById('modalBodyText');
    
    btns.forEach(btn => btn.classList.remove('active'));
    
    if (type === 'Description') {
        btns[0].classList.add('active');
        body.innerText = currentModalItem.description || "No description available.";
    } else {
        btns[1].classList.add('active');
        body.innerText = currentModalItem.transcript;
    }
}

// --- SEARCH & FILTERS ---
function renderTags() {
    const tagContainer = document.getElementById('filter-tags');
    const allTags = new Set(["All"]);
    announcementData.forEach(item => item.tags.forEach(t => allTags.add(t)));
    
    tagContainer.innerHTML = Array.from(allTags).map(tag => 
        `<span style="border-color: var(--smrt-ccl-color);" class="tag-filter ${tag === activeTag ? 'smrt-ccl' : ''}" data-tag="${tag}">${tag}</span>`
    ).join('');

    tagContainer.querySelectorAll('.tag-filter').forEach(el => {
        el.addEventListener('click', () => {
            activeTag = el.dataset.tag;
            renderTags();
            handleSearch();
        });
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
