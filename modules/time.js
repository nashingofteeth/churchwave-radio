// Time management module for time-related operations

import { getState } from './state.js';

export function getTimeOfDay() {
  const state = getState();
  const date = state.simulatedDate || new Date();
  const currentHour = date.getHours();
  if (currentHour >= 0 && currentHour < 5) return "lateNight";
  if (currentHour >= 5 && currentHour < 10) return "morning";
  if (currentHour >= 10 && currentHour < 16) return "day";
  if (currentHour >= 16 && currentHour < 19) return "evening";
  if (currentHour >= 19 && currentHour < 24) return "night";
}

export function getCurrentTime() {
  const state = getState();
  const date = state.simulatedDate || new Date();
  return new Date(getLocaleString(date));
}

export function getLocaleString(date) {
  const state = getState();
  return date.toLocaleString("en-US", { timeZone: state.config.timezone || "America/New_York" });
}

export function parseTimeString(timeStr) {
  const [hours, minutes, seconds = 0] = timeStr.split(':').map(Number);
  return { hours, minutes, seconds };
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
