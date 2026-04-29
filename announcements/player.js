async function initPlayer(lineConfig) {
    const { jsonUrl, lineClass } = lineConfig;
    const grid = document.getElementById('announcement-grid');
    const modal = document.getElementById('infoModal');
    const closeBtn = document.querySelector('.close-button');

    try {
        const response = await fetch(jsonUrl);
        const data = await response.json();

        function renderCards(items) {
            grid.innerHTML = '';
            items.forEach(item => {
                const card = document.createElement('div');
                card.className = `announcement-card ${lineClass}`;
                card.innerHTML = `
                    <div class="card-body">
                        <h3>${item.title}</h3>
                        <button class="show-more" onclick="openAnnouncementModal(${JSON.stringify(item).replace(/"/g, '&quot;')})">Show more</button>
                        <div class="player-controls">
                            <button class="play-btn" onclick="playAudio('${item.audioUrl}', this)">
                                <img src="icons/play.svg" alt="Play">
                            </button>
                            <input type="range" class="seek-bar" value="0" max="100">
                            <a href="${item.audioUrl}" download class="download-btn">
                                <img src="icons/download.svg" alt="Download">
                            </a>
                        </div>
                    </div>
                `;
                grid.appendChild(card);
            });
        }

        renderCards(data);

        // Global function for the modal (called by the buttons)
        window.openAnnouncementModal = (item) => {
            document.getElementById('modalTitle').innerText = item.title;
            document.getElementById('modalMeta').innerText = `Category: ${item.category} | Voice: ${item.voice}`;
            document.getElementById('Description').innerText = item.description;
            document.getElementById('Transcript').innerText = item.transcript;
            modal.style.display = 'block';
        };

        // Close modal logic
        closeBtn.onclick = () => modal.style.display = 'none';
        window.onclick = (event) => { if (event.target == modal) modal.style.display = 'none'; };

    } catch (error) {
        console.error('Error loading announcements:', error);
    }
}

// Simple Audio Controller
let currentAudio = null;
function playAudio(url, btn) {
    if (currentAudio) {
        currentAudio.pause();
        if (currentAudio.src === url) {
            currentAudio = null;
            return;
        }
    }
    // Replace dropbox URL for direct play if necessary
    const playUrl = url.replace('www.dropbox.com', 'dl.dropboxusercontent.com');
    currentAudio = new Audio(playUrl);
    currentAudio.play();
}
