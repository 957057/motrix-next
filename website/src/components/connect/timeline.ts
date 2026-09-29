/** @fileoverview Cue times (seconds) for the Rayburst Connect demo loop. */
export const LOOP = 17

export const CUE = {
  badge: 0.5,
  openClick: 1.15,
  rows: 1.45,
  rowClick: 2.95,
  probeEnd: 4.25,
  mkvClick: 5.25,
  dlClick: 6.2,
  submitted: 7.05,
  fly: 7.25,
  arrive: 8.05,
  close: 14.8,
  fadeOut: 16.3,
} as const

export const CLICKS = [CUE.openClick, CUE.rowClick, CUE.mkvClick, CUE.dlClick] as const
