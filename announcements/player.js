let announcementData = [];
let activeTag = "All";

const iconPaths = {
    play: "icons/play.svg",
    pause: "icons/pause.svg",
    restart: "icons/restart.svg",
    download: "icons/download.svg"
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
        `<span style="border-color: var(--line-color);" class="tag-filter ${tag === activeTag ? 'smrt-ccl' : ''}" data-tag="${tag}">${tag}</span>`
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
                <div>${item.tags.map(t => `<span class="tag-mini">${t}</span>`).join('')}</div>
            </div>
            <button class="annc-show-more" onclick="openModal(${JSON.stringify(item).replace(/"/g, '&quot;')})">
                Show More
            </button>
            <div class="custom-player">
                <div class="controls">
                    <button class="play-btn">
                        <img src="${iconPaths.play}" class="ctrl-icon" alt="Play">
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
    const audio = new Audio();
    audio.src = src;
    audio.preload = "metadata";

    const playBtn = card.querySelector('.play-btn');
    const playImg = playBtn.querySelector('img');
    const restartBtn = card.querySelector('.restart-btn'); // You can keep or remove this button now
    const progress = card.querySelector('.progress-bar');
    const timeDisp = card.querySelector('.time-display');

    playBtn.addEventListener('click', () => {
        if (playImg.src.includes('restart.svg')) {
            audio.currentTime = 0;
        }

        if (audio.paused) {
            document.querySelectorAll('audio').forEach(a => {
                if (a !== audio) {
                    a.pause();
                    const otherImg = a.parentElement?.querySelector('.play-btn img');
                    if (otherImg) otherImg.src = iconPaths.play;
                }
            });
            audio.play();
            playImg.src = iconPaths.pause;
        } else {
            audio.pause();
            playImg.src = iconPaths.play;
        }
    });

    audio.addEventListener('timeupdate', () => {
        progress.value = (audio.currentTime / audio.duration) * 100 || 0;
        timeDisp.innerText = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
    });

    progress.addEventListener('input', () => {
        audio.currentTime = (progress.value / 100) * audio.duration;
        
        if (audio.paused) {
            playImg.src = iconPaths.play;
        }
    });
    
    audio.addEventListener('ended', () => { 
        playImg.src = iconPaths.restart; 
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

let currentModalItem = null;

function openModal(item) {
    currentModalItem = item;
    const modal = document.getElementById('infoModal');
    
    // Set text content
    document.getElementById('modalTitle').innerText = item.title;
    document.getElementById('modalTags').innerHTML = item.tags.map(t => `<span class="tag-mini">${t}</span>`).join('');
    
    // Reset to Description tab
    switchTab('Description');
    
    // Setup Modal Player
    const downloadLink = document.getElementById('modalDownload');
    downloadLink.href = item.file;
    
    // Trigger modal visibility
    modal.style.display = 'block';
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

// Close modal when clicking (x) or outside the box
document.querySelector('.close-button').onclick = () => {
    document.getElementById('infoModal').style.display = 'none';
};

window.onclick = (event) => {
    const modal = document.getElementById('infoModal');
    if (event.target == modal) modal.style.display = 'none';
};

document.getElementById('search-input').addEventListener('input', handleSearch);
document.querySelectorAll('input[name="search-type"]').forEach(r => r.addEventListener('change', handleSearch));

init();
