/** How many simulated minutes the timeline shows. */
export const WINDOW_MINUTES = 30
/** Gridline labels on the timeline, in minutes before now. */
export const TIMELINE_TICKS = [25, 20, 15, 10, 5]
/** Simulated minutes that pass per real second. A whole flow plays in about 15 seconds. */
export const SIM_MINUTES_PER_SECOND = 1.4
/** Ignore long frame gaps (a hidden tab) so time doesn't jump. */
export const MAX_FRAME_SECONDS = 0.1
/** Pause between one stage finishing and the next starting, in simulated minutes. */
export const HANDOFF_MINUTES = 0.6
/** How far into a step (0–1) the agent gets before it needs approval to act. */
export const GATE_AT = 0.7

/** "Ask until it's earned it": approvals in a row before it starts asking less. */
export const EARN_AFTER = 3
/** Each further approval multiplies the chance of asking by this. */
export const ASK_DECAY = 0.6
/** It never stops asking completely. */
export const ASK_FLOOR = 0.1
/** Runs simulated by "Fast-forward a week". */
export const FAST_FORWARD_RUNS = 7
/** How many past runs the approvals strip shows. */
export const RUNS_SHOWN = 24
/** Runs the strip's summary line looks back over. */
export const RUNS_SUMMARY = 5

/** Canvas layout, in flow units. Cards are `w-72` (18rem). */
export const NODE_WIDTH = 288
export const NODE_HEIGHT = 240
export const STAGE_GAP = 96
export const ROW_GAP = 32
export const STAGE_WIDTH = NODE_WIDTH + STAGE_GAP
/** A dropped card joins a stage when it lands within this share of a stage's width. */
export const JOIN_STAGE_TOLERANCE = 0.3
/** fitView animation and padding. */
export const FIT_DURATION_MS = 500
export const FIT_PADDING = 0.25
