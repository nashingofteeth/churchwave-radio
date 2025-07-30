/**
 * Time management module
 * Handles time simulation, time slot determination, and time-based operations
 */

import {
  getApplicationState,
  updateApplicationState,
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
import { beginPlayback } from "./core.js";

/**
 * Determine the algorithmic time slot for a given hour
 * @param {number} [currentHour] - Hour to check (uses current time if not provided)
 * @returns {string} Time slot name ("lateNightLoFis", "morning", or "standard")
 */
export function getAlgorithmicTimeSlot(currentHour) {
  const state = getApplicationState();

  if (!currentHour) {
    const currentTime = getCurrentTime();
    currentHour = currentTime.getHours();
  }

  // Use pre-computed hour-to-timeslot mapping for instant lookup
  const hourToTimeSlot = state.preprocessed?.timeSlots?.hourToTimeSlot;
  if (!hourToTimeSlot) {
    console.warn("Hour to timeslot mapping not available, defaulting to standard");
    return "standard";
  }
  
  return hourToTimeSlot[currentHour] || "standard";
}

/**
 * Get the current time, accounting for time simulation
 * @returns {Date} Current time (real or simulated)
 */
export function getCurrentTime() {
  const state = getApplicationState();

  // If we're not simulating time, return the actual current time
  if (!state.isTimeSimulated) {
    return getConfiguredTime();
  }

  // Return simulated time (copy to prevent mutation)
  return new Date(state.simulatedTime);
}

/**
 * Stop time simulation and return to real time
 */
export function stopTimeSimulation() {
  stopSimulationClock();

  updateApplicationState({
    isTimeSimulated: false,
    simulationSpeed: 1,
  });
}

/**
 * Start time simulation at specified speed
 * @param {number} [speed=1] - Simulation speed multiplier
 */
export function startTimeSimulation(speed = 1) {
  stopSimulationClock();

  const simulationInterval = setInterval(() => {
    const state = getApplicationState();
    state.simulatedTime.setSeconds(state.simulatedTime.getSeconds() + speed);

    // Log time every minute for debugging
    if (state.simulatedTime.getSeconds() === 0) {
      console.log(
        `Simulated time: ${state.simulatedTime.toLocaleTimeString()}`,
      );
    }
  }, 1000);

  updateApplicationState({
    simulationInterval,
    isTimeSimulated: true,
    simulationSpeed: speed,
  });
}

/**
 * Set the simulated time to a specific hour, minute, and second
 * @param {number} hour - Hour (0-23)
 * @param {number} [minute=0] - Minute (0-59)
 * @param {number} [second=0] - Second (0-59)
 * @param {Date} [date=null] - Base date (uses current date if null)
 * @returns {Date} The set simulated time
 */
function setSimulatedTime(hour, minute = 0, second = 0, date = null) {
  const newTime = date ? new Date(date) : new Date();
  newTime.setHours(hour, minute, second, 0);

  updateApplicationState({ simulatedTime: newTime });

  console.log(`Simulated time set to: ${newTime.toLocaleString()}`);
  return newTime;
}

/**
 * Stop the simulation clock interval
 */
function stopSimulationClock() {
  const state = getApplicationState();
  if (state.simulationInterval) {
    clearInterval(state.simulationInterval);
    updateApplicationState({ simulationInterval: null });
  }
}

/**
 * Get time adjusted for configured timezone
 * @param {Date} [date=null] - Source date (uses current time if null)
 * @returns {Date} Time adjusted for configured timezone
 */
export function getConfiguredTime(date = null) {
  const state = getApplicationState();
  const sourceTime = date || new Date();

  if (state.timezoneOffset !== null) {
    return new Date(sourceTime.getTime() + state.timezoneOffset);
  } else {
    return new Date(sourceTime);
  }
}

/**
 * Parse a time string into hour, minute, and second components
 * @param {string} timeStr - Time string in format "HH:MM" or "HH:MM:SS"
 * @returns {Object} Object with hours, minutes, and seconds properties
 */
export function parseTimeString(timeStr) {
  const [hours, minutes, seconds = 0] = timeStr.split(":").map(Number);
  return { hours, minutes, seconds };
}

/**
 * Generate a random start time for a track to avoid playing from the beginning
 * @param {number} duration - Track duration in seconds
 * @returns {number} Random start time in seconds (up to 90% of track duration)
 */
export function getRandomStartTime(duration) {
  return Math.floor(Math.random() * (duration * 0.9));
}

/**
 * Reset system state for time simulation
 * Clears timeouts, listeners, usage tracking, and restarts playback
 */
function resetForTimeSimulation() {
  clearAllScheduledTimeouts();

  updateApplicationState({
    isInScheduledMode: false,
    preScheduledJunkOnly: false,
    preScheduledNonBumperJunkOnly: false,
  });

  cleanupCurrentTrackListeners();
  cleanupScheduledTrackListeners();

  clearUsedAlgorithmicTracks();
  clearUsedJunkTracks();
  clearUsedScheduledTracks();

  startScheduledSystem();
  beginPlayback();
}

/**
 * Start time simulation at a specific time
 * @param {number} hour - Hour to simulate (0-23)
 * @param {number} [minute=0] - Minute to simulate (0-59)
 * @param {number} [second=0] - Second to simulate (0-59)
 * @param {Date} [date=null] - Base date for simulation
 */
export function simulateTime(hour, minute = 0, second = 0, date = null) {
  const state = getApplicationState();
  if (!state.preprocessed) {
    console.error("Playback not started");
    return;
  }
  setSimulatedTime(hour, minute, second, date);
  startTimeSimulation(1);
  resetForTimeSimulation();
}

/**
 * Clear time simulation and return to real time
 * Resets the system to use actual current time
 */
export function clearTimeSimulation() {
  stopTimeSimulation();
  resetForTimeSimulation();

  console.log("Time simulation cleared - using real time");
}
