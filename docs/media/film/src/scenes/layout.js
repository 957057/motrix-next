/**
 * Screen-space layout constants shared across scenes. The desk world (the
 * Rayburst window and the browser) lives in desk.js; the engine chip sits
 * where the Connect dive ends, so the gold iris opens from the same point.
 */
import { originOnScreen } from '../brand/logo.js'

export const LOGO_BURST = { x: 600, y: 540, size: 460 }
export const BURST_ORIGIN = originOnScreen(LOGO_BURST.x, LOGO_BURST.y, LOGO_BURST.size)

export const LOGO_OUTRO = { x: 960, y: 395, size: 330 }

export const WAIT_ROW = { y: 650, x0: 160, x1: 1760 }

export const CHIP = { x: 1330, y: 540, size: 300 }
