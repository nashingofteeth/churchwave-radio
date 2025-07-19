// Time management module for time-related operations

import { reset } from './core.js';
import { getState, updateState } from './state.js';

export function getAlgorithmicTimeSlot(currentHour) {
  const state = getState();

  if (!currentHour) {
    const currentTime = getCurrentTime();
    currentHour = currentTime.getHours();
  }

  // Get time slots from config
  const algorithmicTimeSlots = state.config.directories.algorithmic.subdirectories;

  let timeSlot = "standard"; // Default fallback

  // Check each time slot to find which one the current time falls into
  for (const [slotName, slotConfig] of Object.entries(algorithmicTimeSlots)) {
    if (!slotConfig.startTime || !slotConfig.endTime) continue;

    const startTime = parseTimeString(slotConfig.startTime);
    const endTime = parseTimeString(slotConfig.endTime);

    // Handle time slots that cross midnight
    if (startTime.hours > endTime.hours) {
      if (currentHour >= startTime.hours || currentHour < endTime.hours) {
        timeSlot = slotName;
        break;
      }
    } else {
      if (currentHour >= startTime.hours && currentHour < endTime.hours) {
        timeSlot = slotName;
        break;
      }
    }
  }

  return timeSlot;
}

export function getCurrentTime() {
  const state = getState();
  // Return a copy to prevent mutation
  return new Date(state.currentTime);
}

export function initializeClock() {
  const initialTime = getConfiguredTime();

  updateState({
    currentTime: initialTime,
    isSimulatedTime: false,
    simulatedSpeed: 1
  });

  startRealTimeClock();
  console.log(`Clock initialized: ${initialTime.toLocaleTimeString()}`);
}

export function startRealTimeClock() {
  stopClock(); // Clear any existing clock

  const clockInterval = setInterval(() => {
    const state = getState();
    state.currentTime.setSeconds(state.currentTime.getSeconds() + 1);
  }, 1000);

  updateState({
    clockInterval,
    isSimulatedTime: false,
    simulatedSpeed: 1
  });
}

export function startSimulatedClock(speed = 1) {
  stopClock(); // Clear any existing clock

  const clockInterval = setInterval(() => {
    const state = getState();
    state.currentTime.setSeconds(state.currentTime.getSeconds() + speed);

    // Optional: Log time every minute for debugging
    if (state.currentTime.getSeconds() === 0) {
      console.log(`Clock time: ${state.currentTime.toLocaleTimeString()}`);
    }
  }, 1000);

  updateState({
    clockInterval,
    isSimulatedTime: true,
    simulatedSpeed: speed
  });
}

export function setClockTime(hour, minute = 0, second = 0, date = null) {
  const state = getState();
  const newTime = date ? new Date(date) : new Date(state.currentTime);
  newTime.setHours(hour, minute, second, 0);

  updateState({ currentTime: newTime });

  console.log(`Clock set to: ${newTime.toLocaleTimeString()}`);
  return newTime;
}

export function stopClock() {
  const state = getState();
  if (state.clockInterval) {
    clearInterval(state.clockInterval);
    updateState({ clockInterval: null });
  }
}

export function getConfiguredTime(date = null) {
  const state = getState();
  const sourceTime = date || new Date();

  if (state.config.timezone) {
    const localTime = sourceTime.toLocaleString("en-US", { timeZone: state.config.timezone });
    return new Date(localTime);
  } else {
    return new Date(sourceTime);
  }
}

export function parseTimeString(timeStr) {
  const [hours, minutes, seconds = 0] = timeStr.split(':').map(Number);
  return { hours, minutes, seconds };
}

export function getRandomStartTime(duration) {
  return Math.floor(Math.random() * (duration * 0.9));
}

// Simulation function that properly handles reset and initialization
export function simulateTime(hour, minute = 0, second = 0, date = null) {
  // Set the clock time
  setClockTime(hour, minute, second, date);

  // Reset the application with simulated time
  reset();

  // Start simulated time progression
  startSimulatedClock(1);
}

export function clearSimulatedTime() {
  const realTime = getConfiguredTime();

  // Update clock to real time
  updateState({ currentTime: realTime });

  // Switch back to real time clock
  startRealTimeClock();

  // Reset the application
  reset();

  console.log('Cleared simulated time - now using real time');
}
