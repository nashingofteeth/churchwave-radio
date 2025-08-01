/**
 * Currently Playing Indicator Module
 * Manages the atmospheric text display that updates when tracks end
 */

import { getApplicationState, updateApplicationState } from "./state.js";
import { ATMOSPHERIC_MESSAGES } from "./messages.js";

/**
 * Get a random atmospheric message
 * @returns {string} Random message from the atmospheric messages array
 */
function getRandomMessage() {
    const state = getApplicationState();
    const randomIndex = Math.floor(Math.random() * ATMOSPHERIC_MESSAGES.length);
    // Ensure we don't repeat the same message twice in a row
    if (randomIndex === state.currentMessageIndex && ATMOSPHERIC_MESSAGES.length > 1) {
        return getRandomMessage();
    }
    updateApplicationState({ currentMessageIndex: randomIndex });
    return ATMOSPHERIC_MESSAGES[randomIndex];
}

/**
 * Update the currently playing indicator with a new message
 */
export function updateCurrentlyPlayingIndicator() {
    const state = getApplicationState();
    if (state.currentlyPlayingText) {
        const newMessage = getRandomMessage();
        state.currentlyPlayingText.textContent = newMessage;
    }
}
