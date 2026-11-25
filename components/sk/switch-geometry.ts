/**
 * Switch track & thumb geometry source of truth.
 * Modify sizes here only; shared with styles and e2e to ensure equal 4-side inset.
 *
 * Formulas:
 *   thumb  = trackH - 2 * border - 2 * inset
 *   travel = trackW - 2 * border - 2 * inset - thumb
 */
export const SWITCH_TRACK_H = 20
export const SWITCH_TRACK_W = 36
export const SWITCH_BORDER = 1
export const SWITCH_INSET = 2

export const SWITCH_THUMB = SWITCH_TRACK_H - 2 * SWITCH_BORDER - 2 * SWITCH_INSET
export const SWITCH_TRAVEL = SWITCH_TRACK_W - 2 * SWITCH_BORDER - 2 * SWITCH_INSET - SWITCH_THUMB

/** Default desktop switch: 20px x 36px */
export const switchTrackClass = 'h-5 w-9 border p-[2px]'
export const switchThumbClass = 'aspect-square h-full'

/** Compact row switch: 18px x 32px */
export const SWITCH_SM_TRACK_H = 18
export const SWITCH_SM_TRACK_W = 32
export const SWITCH_SM_INSET = 2
export const SWITCH_SM_THUMB = SWITCH_SM_TRACK_H - 2 * SWITCH_BORDER - 2 * SWITCH_SM_INSET
export const SWITCH_SM_TRAVEL = SWITCH_SM_TRACK_W - 2 * SWITCH_BORDER - 2 * SWITCH_SM_INSET - SWITCH_SM_THUMB
export const switchTrackSmClass = 'h-[18px] w-8 border p-[2px]'
