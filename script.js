/* ==========================================================================
   FocusFlow — Nature & Calm Study Sanctuary Script
   Accurate Timer, LocalStorage Task Management, Daily Progress,
   Nature Ambient Sound & Calming Leaf Animation
   ========================================================================== */

const STORAGE_KEY = "focusflow_tasks_v1";
const STATS_KEY = "focusflow_sanctuary_stats_v1";

const state = {
  tasks: loadTasks(),
  filter: "all",
  editingId: null,
  toastTimer: null,
  
  // Timer state
  timerDurationMinutes: 25,
  timerSeconds: 25 * 60,
  timerInitialSeconds: 25 * 60,
  timerRunning: false,
  timerTargetTimestamp: null,
  timerInterval: null,
  
  // Ambient Sound
  musicEnabled: true,
  currentSoundscape: "lofi",
  audioContext: null,
  soundOscillators: [],
  soundInterval: null,
  
  // Daily Progress
  stats: loadStats()
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

// ==========================================================================
// STORAGE & DATA HANDLING
// ==========================================================================

function todayString() {
  const date = new Date();
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function loadTasks() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Could not load saved tasks:", error);
    return [];
  }
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
}

function loadStats() {
  const today = todayString();
  try {
    const stored = localStorage.getItem(STATS_KEY);
    const parsed = stored ? JSON.parse(stored) : {};
    if (parsed.date !== today) {
      return { date: today, focusMinutes: 0 };
    }
    return parsed;
  } catch {
    return { date: today, focusMinutes: 0 };
  }
}

function saveStats() {
  localStorage.setItem(STATS_KEY, JSON.stringify(state.stats));
}

function addFocusMinutes(minutes) {
  if (state.stats.date !== todayString()) {
    state.stats.date = todayString();
    state.stats.focusMinutes = 0;
  }
  state.stats.focusMinutes += minutes;
  saveStats();
  renderProgressStats();
}

function makeId() {
  return window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(`${dateString}T00:00:00`);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
}

// ==========================================================================
// FLOATING LEAVES BACKGROUND EFFECT
// ==========================================================================

function initNatureParticles() {
  const container = $("#natureParticles");
  if (!container) return;
  const leafTypes = ["🍃", "🍂", "🌿", "🌱"];
  const count = 12;

  for (let i = 0; i < count; i++) {
    const leaf = document.createElement("div");
    leaf.className = "floating-leaf";
    leaf.textContent = leafTypes[Math.floor(Math.random() * leafTypes.length)];
    leaf.style.left = `${Math.random() * 96}%`;
    leaf.style.top = `${Math.random() * -20}px`;
    leaf.style.fontSize = `${12 + Math.random() * 12}px`;
    const duration = 18 + Math.random() * 22;
    const delay = Math.random() * 20;
    leaf.style.animationDuration = `${duration}s`;
    leaf.style.animationDelay = `${delay}s`;
    container.appendChild(leaf);
  }
}

// ==========================================================================
// TIMER SYSTEM (Accurate Timestamp-based, Background Resilient)
// ==========================================================================

const CIRCUMFERENCE_TIMER = 2 * Math.PI * 96; // ~603.18
const CIRCUMFERENCE_RING = 2 * Math.PI * 40;  // ~251.32

function setTimerDuration(minutes) {
  if (state.timerRunning) {
    pauseTimer();
  }
  state.timerDurationMinutes = minutes;
  state.timerSeconds = minutes * 60;
  state.timerInitialSeconds = minutes * 60;
  
  const isStandard = [15, 25, 45, 60].includes(minutes);
  $$(".duration-btn").forEach(btn => {
    if (btn.id === "customDurationBtn") {
      btn.classList.toggle("active", !isStandard);
      if (!isStandard) {
        const hrs = (minutes / 60).toFixed(1).replace(/\.0$/, "");
        btn.textContent = `Custom (${hrs} hr${minutes >= 120 ? "s" : ""})`;
      } else {
        btn.textContent = "+ Custom Hours";
      }
    } else {
      btn.classList.toggle("active", Number(btn.dataset.minutes) === minutes);
    }
  });

  updateTimerDisplay();
  updateFocusTaskTitle();
  $("#timerStatusLabel").textContent = "ready to begin";
  $("#toggleTimerBtn").disabled = false;
  $("#toggleTimerText").textContent = "Start Focus";
  $("#toggleTimerIcon").textContent = "▶";
}

function updateTimerDisplay() {
  const totalSeconds = state.timerSeconds;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  let displayStr = "";
  if (hours > 0) {
    displayStr = `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  } else {
    displayStr = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  $("#timerDisplay").textContent = displayStr;

  // Update circular dial progress
  const circle = $("#timerCircleProgress");
  if (circle) {
    const progress = state.timerInitialSeconds > 0
      ? (state.timerInitialSeconds - state.timerSeconds) / state.timerInitialSeconds
      : 0;
    const offset = CIRCUMFERENCE_TIMER * (1 - progress);
    circle.style.strokeDashoffset = offset;
  }
}

function startTimer() {
  if (state.timerRunning) {
    pauseTimer();
    return;
  }
  if (state.timerSeconds <= 0) {
    resetTimer();
  }

  state.timerRunning = true;
  state.timerTargetTimestamp = Date.now() + (state.timerSeconds * 1000);

  $("#toggleTimerText").textContent = "Pause";
  $("#toggleTimerIcon").textContent = "Ⅱ";
  $("#timerStatusLabel").textContent = "mindful session in progress";

  startAmbientAudio();

  state.timerInterval = setInterval(() => {
    const now = Date.now();
    const remaining = Math.max(0, Math.round((state.timerTargetTimestamp - now) / 1000));
    state.timerSeconds = remaining;
    updateTimerDisplay();

    if (state.timerSeconds <= 0) {
      completeSession();
    }
  }, 500);
}

function pauseTimer() {
  clearInterval(state.timerInterval);
  state.timerInterval = null;
  state.timerRunning = false;
  stopAmbientAudio();

  $("#toggleTimerText").textContent = "Resume";
  $("#toggleTimerIcon").textContent = "▶";
  $("#timerStatusLabel").textContent = "session paused";
}

function resetTimer() {
  clearInterval(state.timerInterval);
  state.timerInterval = null;
  state.timerRunning = false;
  state.timerSeconds = state.timerInitialSeconds;
  stopAmbientAudio();

  $("#toggleTimerBtn").disabled = false;
  $("#toggleTimerText").textContent = "Start Focus";
  $("#toggleTimerIcon").textContent = "▶";
  $("#timerStatusLabel").textContent = "ready to begin";
  updateTimerDisplay();
}

function completeSession() {
  clearInterval(state.timerInterval);
  state.timerInterval = null;
  state.timerRunning = false;
  state.timerSeconds = 0;
  updateTimerDisplay();
  stopAmbientAudio();

  $("#toggleTimerBtn").disabled = true;
  $("#toggleTimerText").textContent = "Completed";
  $("#toggleTimerIcon").textContent = "✓";
  $("#timerStatusLabel").textContent = "session completed";

  // Add recorded focus minutes
  addFocusMinutes(state.timerDurationMinutes);

  // Show gentle nature completion card
  const banner = $("#completionBanner");
  if (banner) {
    banner.style.display = "flex";
  }
  showToast("Lovely work. Every focused minute counts.");
}

function updateFocusTaskTitle() {
  const pending = state.tasks.filter(t => !t.completed);
  const highPriority = pending.find(t => t.priority === "high");
  const next = highPriority || pending[0];
  const label = $("#focusTaskName");
  if (label) {
    label.textContent = next ? `Intention: ${next.title}` : "Focus on your primary priority";
  }
}

// ==========================================================================
// AMBIENT NATURE AUDIO & SOUNDSCAPES
// ==========================================================================

function getAudioElement() {
  return document.getElementById("focusMusic");
}

function updateAudioUI() {
  const isPlaying = state.timerRunning && state.musicEnabled;
  const card = $("#ambientCard");
  const toggleBtn = $("#musicToggleBtn");
  const toggleText = $("#musicToggleText");
  const statusText = $("#ambientStatusText");
  const quickChip = $("#soundQuickStatus");
  const quickLabel = $("#quickSoundLabel");

  if (toggleBtn) {
    toggleBtn.classList.toggle("active", state.musicEnabled);
    toggleBtn.setAttribute("aria-pressed", String(state.musicEnabled));
  }
  if (toggleText) {
    toggleText.textContent = state.musicEnabled ? "Audio On" : "Audio Off";
  }
  if (card) {
    card.classList.toggle("playing", isPlaying);
  }
  if (quickChip) {
    quickChip.classList.toggle("playing", isPlaying);
  }
  if (quickLabel) {
    quickLabel.textContent = isPlaying ? "Playing Ambient" : "Ambient Sound";
  }

  if (statusText) {
    if (!state.musicEnabled) {
      statusText.textContent = "Audio is muted for this session";
    } else if (isPlaying) {
      statusText.textContent = "Playing serene ambient nature audio ♫";
    } else {
      statusText.textContent = "Plays softly while timer is running";
    }
  }

}

function toggleAudioEnabled() {
  state.musicEnabled = !state.musicEnabled;
  if (state.musicEnabled) {
    if (state.timerRunning) startAmbientAudio();
    showToast("Ambient audio enabled");
  } else {
    stopAmbientAudio();
    showToast("Ambient audio turned off");
  }
  updateAudioUI();
}

function startAmbientAudio() {
  if (!state.musicEnabled || !state.timerRunning) return;
  
  // Try HTML5 audio stream first
  const audio = getAudioElement();
  if (audio) {
    audio.play().catch(() => {
      // If external streaming audio is blocked or offline, use gentle harmonic synth generator
      playHarmonicChords();
    });
  } else {
    playHarmonicChords();
  }
  updateAudioUI();
}

function stopAmbientAudio() {
  const audio = getAudioElement();
  if (audio) {
    audio.pause();
  }
  stopHarmonicChords();
  updateAudioUI();
}

// Gentle WebAudio fallback chords for offline / resilient calm audio
function stopHarmonicChords() {
  if (state.soundInterval) {
    clearInterval(state.soundInterval);
    state.soundInterval = null;
  }
  state.soundOscillators.forEach(node => {
    try { node.stop?.(); } catch (_) {}
    try { node.disconnect?.(); } catch (_) {}
  });
  state.soundOscillators = [];
}

function playHarmonicChords() {
  stopHarmonicChords();
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  if (!state.audioContext) {
    state.audioContext = new AudioContextClass();
  }
  if (state.audioContext.state === "suspended") {
    state.audioContext.resume().catch(() => {});
  }

  const chords = [
    [261.63, 329.63, 392.00], // C major (C, E, G)
    [220.00, 261.63, 329.63], // A minor (A, C, E)
    [174.61, 220.00, 261.63], // F major (F, A, C)
    [196.00, 246.94, 293.66]  // G major (G, B, D)
  ];
  let chordIndex = 0;

  function scheduleChord() {
    if (!state.musicEnabled || !state.timerRunning || !state.audioContext) return;
    const ctx = state.audioContext;
    const now = ctx.currentTime;
    const chord = chords[chordIndex % chords.length];
    chordIndex++;

    chord.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(700, now);

      const peakVol = 0.014;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(peakVol, now + 1.2 + idx * 0.1);
      gain.gain.setValueAtTime(peakVol, now + 4.5);
      gain.gain.linearRampToValueAtTime(0.0001, now + 6.5);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.1);
      osc.stop(now + 6.8);

      state.soundOscillators.push(osc, gain, filter);
    });
  }

  scheduleChord();
  state.soundInterval = setInterval(scheduleChord, 6000);
}

// ==========================================================================
// TASK MANAGER (Add, Complete, Delete, Filter, LocalStorage)
// ==========================================================================

function getVisibleTasks() {
  const query = $("#searchInput").value.trim().toLowerCase();
  let list = [...state.tasks];

  if (state.filter === "pending") {
    list = list.filter(t => !t.completed);
  } else if (state.filter === "completed") {
    list = list.filter(t => t.completed);
  }

  if (query) {
    list = list.filter(t =>
      t.title.toLowerCase().includes(query) ||
      (t.description || "").toLowerCase().includes(query)
    );
  }

  // Sort: pending first, then by date created (newest first)
  list.sort((a, b) => Number(a.completed) - Number(b.completed) || b.createdAt - a.createdAt);
  return list;
}

function renderTasks() {
  renderProgressStats();
  const tasks = getVisibleTasks();
  const listContainer = $("#taskList");
  const emptyState = $("#emptyState");

  listContainer.innerHTML = "";

  tasks.forEach(task => {
    const card = document.createElement("article");
    card.className = `task-card-organic ${task.completed ? "is-completed" : ""}`;
    card.dataset.id = task.id;

    const dueFormatted = task.dueDate ? formatDate(task.dueDate) : "";
    const isOverdue = task.dueDate && !task.completed && task.dueDate < todayString();

    card.innerHTML = `
      <input type="checkbox" class="organic-checkbox" aria-label="Mark task complete" ${task.completed ? "checked" : ""} />
      <div class="task-body">
        <div class="task-headline">${escapeHTML(task.title)}</div>
        ${task.description ? `<div class="task-notes">${escapeHTML(task.description)}</div>` : ""}
        <div class="task-metadata">
          <span class="priority-chip ${escapeHTML(task.priority)}">${escapeHTML(task.priority)}</span>
          ${dueFormatted ? `<span class="due-chip ${isOverdue ? "overdue" : ""}">${isOverdue ? "Overdue · " : "Target: "}${escapeHTML(dueFormatted)}</span>` : ""}
        </div>
      </div>
      <div class="task-actions-wrap">
        <button type="button" class="btn-task-action" data-action="edit" title="Edit intention" aria-label="Edit intention">✎</button>
        <button type="button" class="btn-task-action delete-action" data-action="delete" title="Delete intention" aria-label="Delete intention">✕</button>
      </div>
    `;

    listContainer.appendChild(card);
  });

  const isEmpty = tasks.length === 0;
  emptyState.style.display = isEmpty ? "block" : "none";
  if (isEmpty) {
    const hasAny = state.tasks.length > 0;
    $("#emptyTitle").textContent = hasAny ? "No matching intentions" : "A clean, quiet page";
    $("#emptyText").textContent = hasAny
      ? "Try searching for a different word or changing your filter."
      : "No intentions found. Plant a new goal to cultivate your day.";
    $("#emptyAddBtn").style.display = hasAny ? "none" : "inline-flex";
  }

  updateFocusTaskTitle();
}

function handleTaskListEvents(event) {
  const card = event.target.closest(".task-card-organic");
  if (!card) return;
  const taskId = card.dataset.id;
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  // Toggle Completed Checkbox
  if (event.target.matches(".organic-checkbox")) {
    task.completed = event.target.checked;
    task.completedDate = task.completed ? todayString() : null;
    task.completedAt = task.completed ? Date.now() : null;
    saveTasks();
    renderTasks();
    showToast(task.completed ? "Intention accomplished. Beautiful work!" : "Intention moved back to in-progress");
    return;
  }

  // Action buttons: Edit or Delete
  const actionBtn = event.target.closest(".btn-task-action");
  if (actionBtn) {
    const action = actionBtn.dataset.action;
    if (action === "edit") {
      openTaskModal(task);
    } else if (action === "delete") {
      if (confirm(`Remove "${task.title}" from your sanctuary?`)) {
        state.tasks = state.tasks.filter(t => t.id !== taskId);
        saveTasks();
        renderTasks();
        showToast("Intention removed");
      }
    }
  }
}

// ==========================================================================
// DAILY PROGRESS DASHBOARD (Calculated accurately from stored data)
// ==========================================================================

function renderProgressStats() {
  const today = todayString();
  const allTasks = state.tasks;
  const total = allTasks.length;

  // Filter tasks completed today
  const completedToday = allTasks.filter(t => t.completed && t.completedDate === today).length;
  const pendingCount = allTasks.filter(t => !t.completed).length;
  const allCompleted = allTasks.filter(t => t.completed).length;

  // Filter tabs counts
  $("#filterAllCount").textContent = total;
  $("#filterPendingCount").textContent = pendingCount;
  $("#filterCompletedCount").textContent = allCompleted;

  // Dashboard Card 1: Completed Today
  $("#todayCompletedStat").textContent = completedToday;
  $("#todayPendingCaption").textContent = `${pendingCount} ${pendingCount === 1 ? "intention" : "intentions"} in progress`;

  // Dashboard Card 2: Focus Minutes Today
  $("#focusMinutesStat").textContent = state.stats.focusMinutes || 0;

  // Dashboard Card 3: Completion Harmony Ring
  const rate = total > 0 ? Math.round((allCompleted / total) * 100) : 0;
  const ringBar = $("#progressRingBar");
  if (ringBar) {
    const offset = CIRCUMFERENCE_RING * (1 - rate / 100);
    ringBar.style.strokeDashoffset = offset;
  }
  $("#ringPercentageText").textContent = `${rate}%`;
  $("#ringTasksSummary").textContent = `${allCompleted} of ${total} fulfilled`;
}

// ==========================================================================
// MODAL: ADD / EDIT INTENTION
// ==========================================================================

function openTaskModal(taskToEdit = null) {
  state.editingId = taskToEdit ? taskToEdit.id : null;
  const form = $("#taskForm");
  form.reset();
  $("#formError").textContent = "";

  if (taskToEdit) {
    $("#modalTitle").textContent = "Edit Intention";
    $("#saveTaskBtn").innerHTML = `Update Intention <span>✓</span>`;
    $("#taskTitle").value = taskToEdit.title || "";
    $("#taskDescription").value = taskToEdit.description || "";
    $("#taskPriority").value = taskToEdit.priority || "medium";
    $("#taskDue").value = taskToEdit.dueDate || "";
  } else {
    $("#modalTitle").textContent = "New Intention";
    $("#saveTaskBtn").innerHTML = `Save Intention <span>✓</span>`;
    $("#taskPriority").value = "medium";
  }

  const modal = $("#taskModal");
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  setTimeout(() => $("#taskTitle").focus(), 60);
}

function closeTaskModal() {
  const modal = $("#taskModal");
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  state.editingId = null;
}

function handleFormSubmit(event) {
  event.preventDefault();
  const title = $("#taskTitle").value.trim();
  const description = $("#taskDescription").value.trim();
  const priority = $("#taskPriority").value;
  const dueDate = $("#taskDue").value;

  if (!title) {
    $("#formError").textContent = "Please name your intention before planting it.";
    $("#taskTitle").focus();
    return;
  }

  if (state.editingId) {
    const existing = state.tasks.find(t => t.id === state.editingId);
    if (existing) {
      existing.title = title;
      existing.description = description;
      existing.priority = priority;
      existing.dueDate = dueDate;
      saveTasks();
      closeTaskModal();
      renderTasks();
      showToast("Intention updated");
    }
  } else {
    const newTask = {
      id: makeId(),
      title,
      description,
      priority,
      dueDate,
      completed: false,
      completedDate: null,
      createdAt: Date.now()
    };
    state.tasks.unshift(newTask);
    saveTasks();
    closeTaskModal();
    renderTasks();
    showToast("New intention planted in your sanctuary");
  }
}

// ==========================================================================
// TOAST NOTIFICATIONS
// ==========================================================================

function showToast(message) {
  const toast = $("#toast");
  $("#toastMessage").textContent = message;
  toast.classList.add("show");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}

// ==========================================================================
// INITIALIZATION
// ==========================================================================

function initApp() {
  // Current date
  const now = new Date();
  $("#currentDate").textContent = now.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric"
  });

  // Background floating leaves
  initNatureParticles();

  // Timer duration buttons
  $$(".duration-btn[data-minutes]").forEach(btn => {
    btn.addEventListener("click", () => {
      const mins = Number(btn.dataset.minutes);
      setTimerDuration(mins);
      const drawer = $("#customHoursDrawer");
      if (drawer) drawer.style.display = "none";
    });
  });

  // Custom Hours Drawer toggle
  const customToggle = $("#customDurationBtn");
  const customDrawer = $("#customHoursDrawer");
  if (customToggle && customDrawer) {
    customToggle.addEventListener("click", () => {
      const isOpen = customDrawer.style.display !== "none";
      customDrawer.style.display = isOpen ? "none" : "block";
    });
  }

  // Apply custom hours & minutes
  const applyCustomBtn = $("#applyCustomTimeBtn");
  if (applyCustomBtn) {
    applyCustomBtn.addEventListener("click", () => {
      const hrs = parseFloat($("#customHoursInput").value) || 0;
      const mins = parseFloat($("#customMinsInput").value) || 0;
      const totalMinutes = Math.round(hrs * 60 + mins);

      if (totalMinutes <= 0) {
        showToast("Please enter at least 1 minute of study time.");
        return;
      }
      if (totalMinutes > 1440) { // 24 hours max
        showToast("Please select 24 hours or less.");
        return;
      }

      setTimerDuration(totalMinutes);
      customDrawer.style.display = "none";
      const formatted = hrs > 0 ? `${hrs}h ${mins > 0 ? mins + 'm' : ''}`.trim() : `${mins} min`;
      showToast(`Study timer set to ${formatted}`);
    });
  }

  // Quick hour tags (1.5h, 2h, 3h, 4h)
  $$(".quick-tag-btn").forEach(tag => {
    tag.addEventListener("click", () => {
      const hrs = parseFloat(tag.dataset.hours);
      const totalMinutes = Math.round(hrs * 60);
      $("#customHoursInput").value = Math.floor(hrs);
      $("#customMinsInput").value = Math.round((hrs % 1) * 60);
      setTimerDuration(totalMinutes);
      customDrawer.style.display = "none";
      showToast(`Study timer set to ${hrs} hours`);
    });
  });

  // Timer controls
  $("#toggleTimerBtn").addEventListener("click", startTimer);
  $("#resetTimerBtn").addEventListener("click", resetTimer);

  // Audio controls
  $("#musicToggleBtn").addEventListener("click", toggleAudioEnabled);
  $("#soundQuickStatus").addEventListener("click", toggleAudioEnabled);

  // Soundscape selector
  const soundSelect = $("#ambientSoundSelect");
  if (soundSelect) {
    soundSelect.addEventListener("change", (e) => {
      state.currentSoundscape = e.target.value;
      const audio = getAudioElement();
      if (audio) {
        if (state.currentSoundscape === "rain") {
          audio.src = "https://actions.google.com/sounds/v1/weather/rain_heavy.ogg";
        } else if (state.currentSoundscape === "forest") {
          audio.src = "https://actions.google.com/sounds/v1/environments/forest_birds.ogg";
        } else {
          audio.src = "https://feeds.soundcloud.com/stream/1159581277-unminus-open-minded.mp3";
        }
        if (state.timerRunning && state.musicEnabled) {
          audio.play().catch(() => {});
        }
      }
      showToast(`Soundscape set to ${e.target.options[e.target.selectedIndex].text}`);
    });
  }

  // Dismiss completion banner
  $("#closeCompletionBtn")?.addEventListener("click", () => {
    const banner = $("#completionBanner");
    if (banner) banner.style.display = "none";
  });

  // Task filter pills
  $$(".filter-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      $$(".filter-pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      state.filter = pill.dataset.filter;
      renderTasks();
    });
  });

  // Task search
  $("#searchInput").addEventListener("input", renderTasks);

  // Task list click delegations
  $("#taskList").addEventListener("click", handleTaskListEvents);

  // Modal open & close
  $("#openAddBtn").addEventListener("click", () => openTaskModal());
  $("#emptyAddBtn")?.addEventListener("click", () => openTaskModal());
  $("#closeModalBtn").addEventListener("click", closeTaskModal);
  $("#cancelModalBtn").addEventListener("click", closeTaskModal);
  $("#taskModal").addEventListener("click", (e) => {
    if (e.target === $("#taskModal")) closeTaskModal();
  });
  $("#taskForm").addEventListener("submit", handleFormSubmit);

  // Escape key listener
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if ($("#taskModal").classList.contains("open")) closeTaskModal();
    }
  });

  // Initial renders
  updateTimerDisplay();
  updateAudioUI();
  renderTasks();
}

window.addEventListener("DOMContentLoaded", initApp);
