// Time management module for time-related operations

import { getState } from './state.js';

export function getAlgorithmicTimeSlot() {
  const state = getState();
  const currentTime = getCurrentTime();
  const currentHour = currentTime.getHours();

  // Get time slots from config
  const algorithmicTimeSlots = state.config.directories.algorithmic.subdirectories;

  // Check each time slot to find which one the current time falls into
  for (const [slotName, slotConfig] of Object.entries(algorithmicTimeSlots)) {
    if (!slotConfig.startTime || !slotConfig.endTime) continue;

    const startTime = parseTimeString(slotConfig.startTime);
    const endTime = parseTimeString(slotConfig.endTime);

    // Handle time slots that cross midnight
    if (startTime.hours > endTime.hours) {
      if (currentHour >= startTime.hours || currentHour < endTime.hours) {
        return slotName;
      }
    } else {
      if (currentHour >= startTime.hours && currentHour < endTime.hours) {
        return slotName;
      }
    }
  }

  // Default fallback
  return "standard";
}

export function getCurrentTime() {
  const state = getState();
  const date = state.simulatedDate || new Date();

  if (state.config.timezone) {
    // Convert to locale string with timezone and then back to Date
    return new Date(date.toLocaleString("en-US", { timeZone: state.config.timezone }));
  } else {
    // If no timezone is set, just return a clone of the date
    return new Date(date);
  }
}

export function getLocaleString(date) {
  const state = getState();
  return date.toLocaleString("en-US", { timeZone: state.config.timezone || "America/New_York" });
}

export function parseTimeString(timeStr) {
  const [hours, minutes, seconds = 0] = timeStr.split(':').map(Number);
  return { hours, minutes, seconds };
}

export function getRandomStartTime(duration) {
  return Math.floor(Math.random() * (duration * 0.9));
}

// Simulation function to set date and time to the second
// Note: This function is wrapped in the app module to avoid circular dependencies
export function setSimulatedTime(hour, minute = 0, second = 0, date = null) {
  const state = getState();

  // Set the simulated date
  state.simulatedDate = date ? new Date(date) : new Date();
  state.simulatedDate.setHours(hour, minute, second, 0);
  console.log(`Simulating time: ${getLocaleString(state.simulatedDate)}`);

  return state.simulatedDate;
}

export function startSimulatedTimeProgression() {
  const state = getState();

  // Clear any existing time progression
  if (state.simulatedTimeInterval) {
    clearInterval(state.simulatedTimeInterval);
  }

  // Progress time by 1 second every 1000ms (real time)
  state.simulatedTimeInterval = setInterval(() => {
    if (state.simulatedDate) {
      state.simulatedDate.setSeconds(state.simulatedDate.getSeconds() + 1);

      // Optional: Log time every minute for debugging
      if (state.simulatedDate.getSeconds() === 0) {
        console.log(`Simulated time: ${getLocaleString(state.simulatedDate)}`);
      }
    }
  }, 1000);
}

export function stopSimulatedTimeProgression() {
  const state = getState();
  if (state.simulatedTimeInterval) {
    clearInterval(state.simulatedTimeInterval);
    state.simulatedTimeInterval = null;
  }
}
