/** Base interval for global stat refresh (ms). */
export const STAT_BASE_INTERVAL = 500

/** Additional per-active-task stat interval increment (ms). */
export const STAT_PER_TASK_INTERVAL = 100

/** Minimum stat refresh interval cap (ms). */
export const STAT_MIN_INTERVAL = 500

/** Maximum stat refresh interval cap (ms). */
export const STAT_MAX_INTERVAL = 6000

/** Time the successful engine recovery state remains visible (ms). */
export const ENGINE_RECOVERY_SUCCESS_DURATION = 1200

/** Default duration for notification messages (ms). */
export const MESSAGE_DURATION = 3000

/** Maximum number of in-app notification messages shown at once. */
export const MESSAGE_MAX_COUNT = 3
