// Event listeners module for managing audio element event listeners

import { addToStateArray, clearStateArray, getState } from "./state.js";

export function initializeUIEventListeners() {
  const state = getState();

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

export function addCurrentTrackListener(eventType, handler, options = {}) {
  const state = getState();
  state.theTransmitter.addEventListener(eventType, handler, options);
  addToStateArray("currentTrackListeners", { eventType, handler, options });
}

export function addScheduledTrackListener(eventType, handler, options = {}) {
  const state = getState();
  state.theTransmitter.addEventListener(eventType, handler, options);
  addToStateArray("scheduledTrackListeners", { eventType, handler, options });
}

export function cleanupCurrentTrackListeners() {
  const state = getState();
  state.currentTrackListeners.forEach(({ eventType, handler }) => {
    try {
      state.theTransmitter.removeEventListener(eventType, handler);
    } catch (error) {
      console.warn("Error removing current track listener:", error);
    }
  });
  clearStateArray("currentTrackListeners");
}

export function cleanupScheduledTrackListeners() {
  const state = getState();
  state.scheduledTrackListeners.forEach(({ eventType, handler }) => {
    try {
      state.theTransmitter.removeEventListener(eventType, handler);
    } catch (error) {
      console.warn("Error removing scheduled track listener:", error);
    }
  });
  clearStateArray("scheduledTrackListeners");
}
