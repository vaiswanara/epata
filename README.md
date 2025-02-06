# YouTube Channel Videos and PDF Links

This project displays YouTube channel videos and corresponding PDF links in a table format on a single page. The data is fetched from a text file (`links.txt`) and displayed dynamically using JavaScript.

## Features

- Displays a list of playlists in a dropdown menu.
- Shows videos and PDF links for the selected playlist in a table.
- Responsive design for mobile devices.
- Aligns the first column data to the left for better readability.

## Files

- `epata.html`: The main HTML file that contains the structure of the page.
- `style.css`: The CSS file that styles the page and makes it responsive.
- `script.js`: The JavaScript file that fetches data from `links.txt` and updates the table dynamically.
- `links.txt`: The text file that contains the data for playlists, video titles, YouTube video IDs, and PDF links.

## Usage

1. Clone the repository to your local machine.
2. Open `epata.html` in a web browser.
3. Select a playlist from the dropdown menu to view the videos and PDF links.

## Data Format

The `links.txt` file should have the following format:

```
Playlist, Tittle, YouTube_Vidoe_ID, google_doc_link
Playlist1, Video Title 1, YouTubeID1, PDFLink1
Playlist1, Video Title 2, YouTubeID2, none
Playlist2, Video Title 3, YouTubeID3, PDFLink2
...
```

- `Playlist`: The name of the playlist.
- `Tittle`: The title of the video.
- `YouTube_Vidoe_ID`: The YouTube video ID.
- `google_doc_link`: The link to the PDF document or `none` if there is no PDF.

## Example

Here is an example of the `links.txt` file:

```
Playlist, Tittle, YouTube_Vidoe_ID, google_doc_link
JYOTISHA(KAN)-2025, 01: Course Introduction & Syllabus, QSoXOqu8Z8E, https://drive.google.com/file/d/1iufEAMsGVxlwGgX_7JNWqP_75IEKZ0xJ/view?usp=drive_link
JYOTISHA(KAN)-2025, 02: Introduction to Vedic Astrology, sLimesWCFNk, none
JYOTISHA(KAN)-2025, 03: Astronomy relavent to Astrology, Ewo5H_rRaQ8, none
...
```

## License

This project is licensed under the MIT License.
