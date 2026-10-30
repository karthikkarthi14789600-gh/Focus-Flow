# FocusFlow

FocusFlow is a calm, nature-inspired study dashboard for planning tasks and staying focused. It runs entirely in the browser using HTML, CSS, and vanilla JavaScript.

## Features

- Create, edit, complete, and delete tasks
- Add notes, priorities, and target dates to tasks
- Search tasks and filter by all, pending, or completed
- Use a focus timer with preset durations or a custom duration
- Listen to ambient audio while a focus session is running, with volume controls
- View today's completed-task count, focus minutes, and completion rate
- Save tasks and today's focus-time total in browser `localStorage`
- Responsive layout for desktop and mobile screens

## Run locally

No package installation or build step is required.

1. Download or clone this project.
2. Open `index.html` in a modern browser.

For a local web server, you can also run `python -m http.server 8000` from the project folder, then visit <http://localhost:8000>.

## Project files

- `index.html` — page structure and controls
- `style.css` — layout, styling, animations, and responsive rules
- `script.js` — timer, task management, audio, progress metrics, and local storage

## Data and privacy

Tasks and today's focus-time total are stored in the current browser using `localStorage`. The app does not currently have accounts, a backend, or cross-device synchronization. Clearing browser data can remove saved tasks. Audio playback uses externally hosted audio streams and may depend on network access and the stream provider.

## Tech stack

- HTML5
- CSS3
- Vanilla JavaScript
- Browser `localStorage` and Web Audio API
