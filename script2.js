// Function to fetch the file and parse the contents
async function fetchAndParseData() {
    const response = await fetch('links.txt'); // Assuming the file is in the same directory as your HTML file
    const text = await response.text(); // Get text content of the file

    // Split the text into rows, then split each row by commas to get individual fields
    const rows = text.trim().split('\n');
    const videoData = rows.slice(1).map(row => { // Skip the header row
        const [playlist, title, youtubeID, googleDocLink] = row.split(',').map(item => item.trim());
        return { playlist, title, youtubeID, googleDocLink };
    });

    // Pass the parsed data to the function to display the content
    displayPlaylistAndVideos(videoData);
}

// Function to display the playlists and video titles
function displayPlaylistAndVideos(videoData) {
    const playlistSelect = document.getElementById('playlistSelect');
    const videoList = document.getElementById('videoList');
    const videoPlayer = document.getElementById('videoPlayer');
    const pdfLink = document.getElementById('pdfLink');

    // Get unique playlists
    const playlists = [...new Set(videoData.map(video => video.playlist))];

    // Populate the playlist dropdown
    playlists.forEach(playlist => {
        const option = document.createElement('option');
        option.value = playlist;
        option.textContent = playlist;
        playlistSelect.appendChild(option);
    });

    // Filter and display videos based on selected playlist
    playlistSelect.addEventListener('change', () => {
        const selectedPlaylist = playlistSelect.value;
        
        // Clear the video list and video player
        videoList.innerHTML = '';
        videoPlayer.innerHTML = '';
        pdfLink.style.display = 'none'; // Hide PDF link

        // If a playlist is selected, filter the videos for that playlist
        if (selectedPlaylist) {
            const filteredVideos = videoData.filter(video => video.playlist === selectedPlaylist);

            // Add video titles to the list
            filteredVideos.forEach(video => {
                const listItem = document.createElement('li');
                listItem.textContent = video.title;
                listItem.onclick = () => displayVideo(video);
                videoList.appendChild(listItem);
            });
        }
    });

    // Function to display selected video and its PDF link
    function displayVideo(video) {
        const iframe = document.createElement('iframe');
        iframe.src = `https://www.youtube.com/embed/${video.youtubeID}?autoplay=1`;
        iframe.width = "100%";
        iframe.height = "100%";
        iframe.frameborder = "0";
        iframe.allow = "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture";
        iframe.allowfullscreen = true;
        videoPlayer.innerHTML = '';  // Clear existing iframe
        videoPlayer.appendChild(iframe);

        if (video.googleDocLink !== "none") {
            pdfLink.href = video.googleDocLink;
            pdfLink.style.display = 'inline'; // Show the PDF link
        } else {
            pdfLink.style.display = 'none'; // Hide the PDF link if it's not available
        }
    }
}

// Initialize when the page loads
window.onload = fetchAndParseData;
