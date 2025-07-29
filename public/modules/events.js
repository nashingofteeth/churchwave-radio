/**
 * Event management module
 * Handles UI event listeners and audio element event management
 */

import {
  addToStateArray,
  clearStateArray,
  getApplicationState,
} from "./state.js";

/**
 * Initialize UI event listeners for the start button and audio indicators
 * Sets up the main application start sequence
 */
export function initializeUIEventListeners() {
  const state = getApplicationState();

  const startButtonHandler = async () => {
    state.loadingIndicator.style.display = "block";
    state.startButton.style.display = "none";

    try {
      // Import dynamically to avoid circular dependencies
      const { initializePlayback } = await import("./core.js");
      const success = await initializePlayback();

      if (!success) {
        throw new Error("Failed to initialize");
      }
    } catch (error) {
      console.error("Error during initialization:", error);
      state.loadingIndicator.style.display = "none";
      state.startButton.style.display = "block";
      return;
    }

    const playingHandler = () => {
      state.loadingIndicator.style.display = "none";
      document.getElementById("revealed").style.display = "block";
    };

    state.theTransmitter.addEventListener("playing", playingHandler, {
      once: true,
    });
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

/**
 * Add an event listener for the current algorithmic track
 * @param {string} eventType - Event type (e.g., 'ended', 'loadedmetadata')
 * @param {Function} handler - Event handler function
 * @param {Object} options - Event listener options
 */
export function addCurrentTrackListener(eventType, handler, options = {}) {
  const state = getApplicationState();
  state.theTransmitter.addEventListener(eventType, handler, options);
  addToStateArray("currentTrackListeners", { eventType, handler, options });
}

/**
 * Add an event listener for the current scheduled track
 * @param {string} eventType - Event type (e.g., 'ended', 'loadedmetadata')
 * @param {Function} handler - Event handler function
 * @param {Object} options - Event listener options
 */
export function addScheduledTrackListener(eventType, handler, options = {}) {
  const state = getApplicationState();
  state.theTransmitter.addEventListener(eventType, handler, options);
  addToStateArray("scheduledTrackListeners", { eventType, handler, options });
}

/**
 * Remove all current track event listeners and clear the tracking array
 * Called when switching tracks to prevent memory leaks
 */
export function cleanupCurrentTrackListeners() {
  const state = getApplicationState();
  state.currentTrackListeners.forEach(({ eventType, handler }) => {
    try {
      state.theTransmitter.removeEventListener(eventType, handler);
    } catch (error) {
      console.warn("Error removing current track listener:", error);
    }
  });
  clearStateArray("currentTrackListeners");
}

/**
 * Remove all scheduled track event listeners and clear the tracking array
 * Called when scheduled tracks end to prevent memory leaks
 */
export function cleanupScheduledTrackListeners() {
  const state = getApplicationState();
  state.scheduledTrackListeners.forEach(({ eventType, handler }) => {
    try {
      state.theTransmitter.removeEventListener(eventType, handler);
    } catch (error) {
      console.warn("Error removing scheduled track listener:", error);
    }
  });
  clearStateArray("scheduledTrackListeners");
}
