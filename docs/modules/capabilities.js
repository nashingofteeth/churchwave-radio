/**
 * Mobile capability detection module
 * Detects fade support and setTimeout reliability for adaptive scheduling
 */

import { getApplicationState, updateApplicationState } from "./state.js";
import { getCurrentTime } from "./time.js";

/**
 * Test if volume control works on the actual DOM audio element
 * @returns {Promise<boolean>} True if fade/volume control is supported
 */
async function testVolumeControlSupport() {
  try {
    const state = getApplicationState();

    // Test on the actual audio element that will be used for playback
    const audioElement = state.theTransmitter;
    if (!audioElement) {
      console.warn("Audio element not found in state for volume test");
      return false;
    }

    const originalVolume = audioElement.volume;

    // Try to change volume to a test value
    const testVolume = 0.5;
    audioElement.volume = testVolume;

    // Give browser a moment to process the change
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Check if volume actually changed
    const volumeChanged = Math.abs(audioElement.volume - testVolume) < 0.01;

    // Reset to original volume
    audioElement.volume = originalVolume;

    return volumeChanged;
  } catch (error) {
    console.warn("Volume control test failed:", error);
    return false;
  }
}

/**
 * Test setTimeout reliability by measuring timing accuracy
 * @returns {Promise<boolean>} True if setTimeout is reliable
 */
async function testSetTimeoutReliability() {
  return new Promise((resolve) => {
    const startTime = performance.now();
    const expectedDelay = 1000; // 1 second test

    setTimeout(() => {
      const actualDelay = performance.now() - startTime;
      const accuracy = Math.abs(actualDelay - expectedDelay) / expectedDelay;

      // Consider reliable if within 10% of expected timing
      const isReliable = accuracy < 0.1;

      resolve(isReliable);
    }, expectedDelay);
  });
}

/**
 * Monitor setTimeout performance over time
 * Tracks timing accuracy to detect throttling
 */
class SetTimeoutMonitor {
  constructor() {
    this.samples = [];
    this.maxSamples = 10;
    this.isMonitoring = false;
  }

  startMonitoring() {
    if (this.isMonitoring) return;
    this.isMonitoring = true;
    this.scheduleNext();
  }

  stopMonitoring() {
    this.isMonitoring = false;
  }

  scheduleNext() {
    if (!this.isMonitoring) return;

    const startTime = performance.now();
    const expectedDelay = 5000; // 5 second intervals

    setTimeout(() => {
      const actualDelay = performance.now() - startTime;
      const accuracy = Math.abs(actualDelay - expectedDelay) / expectedDelay;

      this.samples.push({
        timestamp: getCurrentTime(),
        expectedDelay,
        actualDelay,
        accuracy,
      });

      // Keep only recent samples
      if (this.samples.length > this.maxSamples) {
        this.samples.shift();
      }

      // Update capabilities based on recent performance
      this.updateReliabilityStatus();

      // Schedule next test
      this.scheduleNext();
    }, expectedDelay);
  }

  updateReliabilityStatus() {
    if (this.samples.length < 3) return;

    // Get average accuracy of recent samples
    const recentSamples = this.samples.slice(-5);
    const averageAccuracy =
      recentSamples.reduce((sum, sample) => sum + sample.accuracy, 0) /
      recentSamples.length;

    // Consider unreliable if average accuracy is worse than 20%
    const isCurrentlyReliable = averageAccuracy < 0.2;

    const state = getApplicationState();
    if (state.capabilities?.timeoutReliable !== isCurrentlyReliable) {
      console.log(
        `setTimeout reliability changed: ${isCurrentlyReliable ? "reliable" : "unreliable"} (avg accuracy: ${((1 - averageAccuracy) * 100).toFixed(1)}%)`,
      );

      updateApplicationState({
        capabilities: {
          ...state.capabilities,
          timeoutReliable: isCurrentlyReliable,
        },
      });

      // Switch scheduling mode if reliability changed
      this.handleReliabilityChange(isCurrentlyReliable);
    }
  }

  handleReliabilityChange(isReliable) {
    const state = getApplicationState();

    if (!isReliable && !state.capabilities?.opportunisticMode) {
      console.log(
        "Switching to opportunistic scheduling mode due to setTimeout unreliability",
      );
      updateApplicationState({
        capabilities: {
          ...state.capabilities,
          opportunisticMode: true,
        },
      });

      // Migrate existing scheduled tracks to opportunistic mode
      migratePendingScheduledTracks();
    }
  }

  getCurrentStats() {
    if (this.samples.length === 0) return null;

    const recentSamples = this.samples.slice(-5);
    const averageAccuracy =
      recentSamples.reduce((sum, sample) => sum + sample.accuracy, 0) /
      recentSamples.length;

    return {
      sampleCount: this.samples.length,
      averageAccuracy,
      reliabilityPercentage: (1 - averageAccuracy) * 100,
      lastSample: this.samples[this.samples.length - 1],
    };
  }
}

// Global monitor instance
const timeoutMonitor = new SetTimeoutMonitor();

/**
 * Detect device and browser capabilities
 * Tests fade support and setTimeout reliability
 * @returns {Promise<Object>} Capabilities object
 */
export async function detectCapabilities() {
  console.log("Detecting device capabilities...");

  // Test volume control support
  const fadeSupported = await testVolumeControlSupport();

  // Test initial setTimeout reliability
  const timeoutReliable = await testSetTimeoutReliability();

  // Determine if we should use opportunistic mode
  const opportunisticMode = !fadeSupported || !timeoutReliable;

  const capabilities = {
    fadeSupported,
    timeoutReliable,
    opportunisticMode,
    detectedAt: getCurrentTime(),
    monitoringActive: false,
  };

  console.log(
    `Using ${opportunisticMode ? "opportunistic" : "precise"} scheduling mode`,
  );

  return capabilities;
}

/**
 * Start monitoring setTimeout performance
 * Call this after initial capability detection
 */
export function startCapabilityMonitoring() {
  const state = getApplicationState();

  if (state.capabilities?.monitoringActive) {
    console.log("Capability monitoring already active");
    return;
  }

  console.log("Starting setTimeout performance monitoring");
  timeoutMonitor.startMonitoring();

  updateApplicationState({
    capabilities: {
      ...state.capabilities,
      monitoringActive: true,
    },
  });
}

/**
 * Stop monitoring setTimeout performance
 */
export function stopCapabilityMonitoring() {
  timeoutMonitor.stopMonitoring();

  const state = getApplicationState();
  updateApplicationState({
    capabilities: {
      ...state.capabilities,
      monitoringActive: false,
    },
  });

  console.log("Stopped setTimeout performance monitoring");
}

/**
 * Get current setTimeout performance statistics
 * @returns {Object|null} Performance stats or null if no data
 */
export function getTimeoutPerformanceStats() {
  return timeoutMonitor.getCurrentStats();
}

/**
 * Check if opportunistic scheduling should be used
 * @returns {boolean} True if should use opportunistic mode
 */
export function shouldUseOpportunisticScheduling() {
  const state = getApplicationState();
  return state.capabilities?.opportunisticMode || false;
}

/**
 * Check if fade effects should be used
 * @returns {boolean} True if fade effects are supported
 */
export function shouldUseFadeEffects() {
  const state = getApplicationState();
  return state.capabilities?.fadeSupported || false;
}

/**
 * Clear existing scheduled track timeouts when switching to opportunistic mode
 */
function migratePendingScheduledTracks() {
  const state = getApplicationState();

  // Clear any pending setTimeout timers from precise mode
  if (state.scheduledTimeouts && state.scheduledTimeouts.length > 0) {
    console.log(
      `Clearing ${state.scheduledTimeouts.length} pending setTimeout timers`,
    );
    state.scheduledTimeouts.forEach((timeout) => clearTimeout(timeout));

    updateApplicationState({
      scheduledTimeouts: [],
    });

    const trackCount = state.upcomingScheduled.length;
    console.log(
      `Migration complete: ${trackCount} tracks now available for opportunistic scheduling`,
    );
  }
}
