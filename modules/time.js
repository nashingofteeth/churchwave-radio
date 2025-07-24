// Time management module for time-related operations

import {
  getState,
  updateState,
  clearUsedAlgorithmicTracks,
  clearUsedJunkTracks,
} from "./state.js";
import {
  startScheduledSystem,
  clearAllScheduledTimeouts,
  clearUsedScheduledTracks,
} from "./scheduling.js";
import {
  cleanupCurrentTrackListeners,
  cleanupScheduledTrackListeners,
} from "./events.js";
import { startPlayback } from "./core.js";

export function getAlgorithmicTimeSlot(currentHour) {
  const state = getState();

  if (!currentHour) {
    const currentTime = getCurrentTime();
    currentHour = currentTime.getHours();
  }

  // Use pre-computed hour-to-timeslot mapping for instant lookup
  const hourToTimeSlot = state.preprocessed.timeSlots.hourToTimeSlot;
  return hourToTimeSlot[currentHour] || "standard";
}

export function getCurrentTime() {
  const state = getState();

  // If we're not simulating time, return the actual current time
  if (!state.isTimeSimulated) {
    return getConfiguredTime();
  }

  // Return simulated time (copy to prevent mutation)
  return new Date(state.simulatedTime);
}

export function stopTimeSimulation() {
  stopSimulationClock(); // Clear any existing simulation clock

  // No interval needed for real time - getCurrentTime() will fetch real time
  updateState({
    isTimeSimulated: false,
    simulationSpeed: 1,
  });
}

export function startTimeSimulation(speed = 1) {
  stopSimulationClock(); // Clear any existing simulation clock

  const simulationInterval = setInterval(() => {
    const state = getState();
    state.simulatedTime.setSeconds(state.simulatedTime.getSeconds() + speed);

    // Log time every minute for debugging
    if (state.simulatedTime.getSeconds() === 0) {
      console.log(
        `Simulated time: ${state.simulatedTime.toLocaleTimeString()}`,
      );
    }
  }, 1000);

  updateState({
    simulationInterval,
    isTimeSimulated: true,
    simulationSpeed: speed,
  });
}

function setSimulatedTime(hour, minute = 0, second = 0, date = null) {
  const newTime = date ? new Date(date) : new Date();
  newTime.setHours(hour, minute, second, 0);

  updateState({ simulatedTime: newTime });

  console.log(`Simulated time set to: ${newTime.toLocaleString()}`);
  return newTime;
}

function stopSimulationClock() {
  const state = getState();
  if (state.simulationInterval) {
    clearInterval(state.simulationInterval);
    updateState({ simulationInterval: null });
  }
}

export function getConfiguredTime(date = null) {
  const state = getState();
  const sourceTime = date || new Date();

  if (state.config.timezone) {
    const localTime = sourceTime.toLocaleString("en-US", {
      timeZone: state.config.timezone,
    });
    return new Date(localTime);
  } else {
    return new Date(sourceTime);
  }
}

export function parseTimeString(timeStr) {
  const [hours, minutes, seconds = 0] = timeStr.split(":").map(Number);
  return { hours, minutes, seconds };
}

export function getRandomStartTime(duration) {
  return Math.floor(Math.random() * (duration * 0.9));
}

// Minimal reset function for time simulation only
function resetForTimeSimulation() {
  clearAllScheduledTimeouts();

  // Reset scheduling state
  updateState({
    isInScheduledMode: false,
    preScheduledJunkOnly: false,
    preScheduledNonBumperJunkOnly: false,
  });

  // Clear player listeners
  cleanupCurrentTrackListeners();
  cleanupScheduledTrackListeners();

  // Clear track usage
  clearUsedAlgorithmicTracks();
  clearUsedJunkTracks();
  clearUsedScheduledTracks();

  // Restart scheduling system
  startScheduledSystem();

  // Pick something to play
  startPlayback();
}

// Simulation function that properly handles reset and initialization
export function simulateTime(hour, minute = 0, second = 0, date = null) {
  const state = getState();
  if (Object.keys(state.config).length === 0) {
    console.error("Playback not initialized.");
    return;
  }
  // Set the simulated time
  setSimulatedTime(hour, minute, second, date);

  // Start simulated time progression
  startTimeSimulation(1);

  // Reset what's needed for time simulation
  resetForTimeSimulation();
}

export function clearSimulatedTime() {
  // Switch back to real time (no simulatedTime needed since getCurrentTime() fetches real time)
  stopTimeSimulation();

  // Reset what's needed for time simulation
  resetForTimeSimulation();

  console.log("Cleared simulated time - now using real time");
}
