document.querySelectorAll('.custom-player').forEach(player => {
    const audio = new Audio(player.dataset.src);
    const playBtn = player.querySelector('.play-pause');
    const restartBtn = player.querySelector('.restart');
    const progressBar = player.querySelector('.progress-bar');

    // Play/Pause toggle
    playBtn.addEventListener('click', () => {
        if (audio.paused) {
            audio.play();
            playBtn.innerText = '⏸';
        } else {
            audio.pause();
            playBtn.innerText = '▶';
        }
    });

    // Restart functionality
    restartBtn.addEventListener('click', () => {
        audio.currentTime = 0;
        audio.play();
        playBtn.innerText = '⏸';
    });

    // Update progress bar
    audio.addEventListener('timeupdate', () => {
        const percent = (audio.currentTime / audio.duration) * 100;
        progressBar.value = percent;
    });

    // Seek functionality
    progressBar.addEventListener('input', () => {
        const time = (progressBar.value / 100) * audio.duration;
        audio.currentTime = time;
    });

    // Reset UI when finished
    audio.addEventListener('ended', () => {
        playBtn.innerText = '▶';
        progressBar.value = 0;
    });
});

