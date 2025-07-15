// Event listeners module for managing audio element event listeners

import { getState } from './state.js';

export function initializeUIEventListeners() {
  const state = getState();

  const startButtonHandler = () => {
    state.loadingIndicator.style.display = "block";

    // Import startPlayback dynamically to avoid circular dependencies
    import('./core.js').then(({ initialize }) => {
      initialize();
    });

    state.startButton.style.display = "none";

    const playingHandler = () => {
      state.loadingIndicator.style.display = "none";
      document.getElementById("revealed").style.display = "block";
    };

    state.theTransmitter.addEventListener("playing", playingHandler, { once: true });
  };

  state.startButton.addEventListener("click", startButtonHandler);

  // These UI indicator listeners are permanent
  state.theTransmitter.addEventListener("pause", () => {
    state.playingIndicator.classList.remove("playing");
  });
  state.theTransmitter.addEventListener("waiting", () => {
    state.playingIndicator.classList.remove("playing");
  });
  state.theTransmitter.addEventListener("ended", () => {
    state.playingIndicator.classList.remove("playing");
  });
  state.theTransmitter.addEventListener("playing", () => {
    state.playingIndicator.classList.add("playing");
  });
}

export function addCurrentTrackListener(eventType, handler, options = {}) {
  const state = getState();
  state.theTransmitter.addEventListener(eventType, handler, options);
  state.currentTrackListeners.push({ eventType, handler, options });
}

export function addScheduledTrackListener(eventType, handler, options = {}) {
  const state = getState();
  state.theTransmitter.addEventListener(eventType, handler, options);
  state.scheduledTrackListeners.push({ eventType, handler, options });
}

export function cleanupCurrentTrackListeners() {
  const state = getState();
  state.currentTrackListeners.forEach(({ eventType, handler }) => {
    try {
      state.theTransmitter.removeEventListener(eventType, handler);
    } catch (error) {
      console.warn('Error removing current track listener:', error);
    }
  });
  state.currentTrackListeners = [];
}

export function cleanupScheduledTrackListeners() {
  const state = getState();
  state.scheduledTrackListeners.forEach(({ eventType, handler }) => {
    try {
      state.theTransmitter.removeEventListener(eventType, handler);
    } catch (error) {
      console.warn('Error removing scheduled track listener:', error);
    }
  });
  state.scheduledTrackListeners = [];
}

// Private console debugging tool - clears ALL event listeners
export function forceCleanupAllEventListeners() {
  const state = getState();
  cleanupCurrentTrackListeners();
  cleanupScheduledTrackListeners();

  // Nuclear option - remove all event listeners from theTransmitter
  const newTransmitter = state.theTransmitter.cloneNode(true);
  state.theTransmitter.parentNode.replaceChild(newTransmitter, state.theTransmitter);

  // Update the state reference
  state.theTransmitter = newTransmitter;

  console.log('All event listeners forcibly removed - reinitialization required');
}
