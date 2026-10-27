// the timing of a screen that scrolls (scrollweatherdisplay.mjs): one step = one pixel per baseDelay (20 ms, so 50 px/s at the
// normal speed), with HOLD steps (3 s) still at the start and at the end. The idea comes from ws4kp, which sets the time of the
// scroll from the height of the rows instead of fixed numbers.
const HOLD = 150;

// the steps the screen is shown for: hold, the scroll, hold
const scrollSteps = (distance) => HOLD + Math.ceil(distance) + HOLD;

// how far down the box is at a step, never past the end
const scrollOffset = (count, distance) => Math.min(Math.max(count - HOLD, 0), Math.max(distance, 0));

export { HOLD, scrollSteps, scrollOffset };
