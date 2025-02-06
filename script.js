document.addEventListener('DOMContentLoaded', function() {
    fetch('links.txt')
        .then(response => response.text())
        .then(data => {
            const rows = data.trim().split('\n').slice(1).map(row => row.split(',').map(field => field.trim()));
            const playlists = [...new Set(rows.map(row => row[0]))];

            const dropdown = document.getElementById('playlistDropdown');
            playlists.forEach(playlist => {
                const option = document.createElement('option');
                option.value = playlist;
                option.textContent = playlist;
                dropdown.appendChild(option);
            });

            dropdown.addEventListener('change', function() {
                const selectedPlaylist = this.value;
                const filteredRows = rows.filter(row => row[0] === selectedPlaylist);
                const tableBody = document.getElementById('playlistTableBody');
                tableBody.innerHTML = '';
                filteredRows.forEach((row) => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${row[1]}</td>
                        <td>${row[2] && /^[a-zA-Z0-9_-]{11}$/.test(row[2]) ? `<a href="https://www.youtube.com/embed/${row[2]}?autoplay=1&fs=1" target="_blank">Watch Video</a>` : ''}</td>
                        <td>${row[3] && row[3] !== 'none' ? `<a href="${row[3]}" target="_blank">PDF</a>` : ''}</td>
                    `;
                    tableBody.appendChild(tr);
                });
            });
        })
        .catch(error => console.error('Error fetching data:', error));
});
