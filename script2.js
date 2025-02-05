async function fetchAndParseData() {
    document.getElementById('loadingIndicator').style.display = 'block';
    try {
        const response = await fetch('links.txt');
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const text = await response.text();
        const rows = text.trim().split('\n').slice(1); // Skip the header row

        const videoData = rows.map(row => {
            const [playlist, title, youtubeID, googleDocLink] = row.split(',').map(item => item.trim());
            return { playlist, title, youtubeID, googleDocLink };
        });

        displayPlaylistAndVideos(videoData);
    } catch (error) {
        console.error('Failed to fetch and parse data:', error);
        document.body.innerHTML = '<p>Failed to load video data. Please try again later.</p>';
    } finally {
        document.getElementById('loadingIndicator').style.display = 'none';
    }
}

function displayPlaylistAndVideos(videoData) {
    const playlistSelect = document.getElementById('playlistSelect');
    const videoList = document.getElementById('videoList');
    const pdfLink = document.getElementById('pdfLink');

    // Populate playlists
    const playlists = [...new Set(videoData.map(video => video.playlist))];
    playlists.forEach(playlist => {
        const option = document.createElement('option');
        option.value = playlist;
        option.textContent = playlist;
        playlistSelect.appendChild(option);
    });

    // When a playlist is selected
    playlistSelect.addEventListener('change', () => {
        videoList.innerHTML = ''; // Clear previous list
        pdfLink.style.display = 'none'; // Hide PDF link initially

        const selectedPlaylist = playlistSelect.value;
        const filteredVideos = videoData.filter(video => video.playlist === selectedPlaylist);

        filteredVideos.forEach(video => {
            const listItem = document.createElement('li');
            listItem.textContent = video.title;
            listItem.style.cursor = 'pointer';

            listItem.addEventListener('click', () => {
                // Open YouTube video in a new tab (fullscreen)
                const youtubeURL = `https://www.youtube.com/embed/${video.youtubeID}?autoplay=1&fs=1`;
                const newTab = window.open(youtubeURL, '_blank');
                if (newTab) {
                    newTab.focus();
                }

                // Show PDF link if available
                if (video.googleDocLink.toLowerCase() !== 'none') {
                    pdfLink.href = video.googleDocLink;
                    pdfLink.style.display = 'block';
                } else {
                    pdfLink.style.display = 'none';
                }
            });

            videoList.appendChild(listItem);
        });
    });
}

// Call the fetch function when the page loads
fetchAndParseData();
