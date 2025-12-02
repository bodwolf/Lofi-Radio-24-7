var player;

// 1. دالة يتم استدعاؤها تلقائياً عند تحميل مكتبة يوتيوب
function onYouTubeIframeAPIReady() {
    player = new YT.Player('player-hidden', {
        height: '0',
        width: '0',
        // هذا هو ID البث المباشر لقناة Lofi Girl الشهيرة
        videoId: 'sF80I-TQiW0', 
        playerVars: {
            'autoplay': 0,
            'controls': 0,
            'showinfo': 0,
            'modestbranding': 1,
            'loop': 1
        },
        events: {
            'onReady': onPlayerReady
        }
    });
}

// 2. عند جاهزية المشغل
function onPlayerReady(event) {
    // إعداد مستوى الصوت الافتراضي
    player.setVolume(50);
}

// 3. ربط الأزرار بالوظائف
const playBtn = document.getElementById('playBtn');
const pauseBtn = document.getElementById('pauseBtn');
const volumeSlider = document.getElementById('volumeSlider');

playBtn.addEventListener('click', () => {
    player.playVideo();
    playBtn.classList.add('hidden');
    pauseBtn.classList.remove('hidden');
});

pauseBtn.addEventListener('click', () => {
    player.pauseVideo();
    pauseBtn.classList.add('hidden');
    playBtn.classList.remove('hidden');
});

volumeSlider.addEventListener('input', (e) => {
    player.setVolume(e.target.value);
});