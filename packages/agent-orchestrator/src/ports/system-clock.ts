/**
 * High-Resolution Clock implementation.
 * Re-exports the high-resolution clock from @conveaux/port-high-resolution-clock.
 */

export {
  createHighResolutionClock,
  createNodeTimestamper,
  createBrowserTimestamper,
  createDateTimestamper,
} from '@conveaux/port-high-resolution-clock';
export type {
  HighResolutionClock,
  HighResolutionClockOptions,
  Timestamper,
} from '@conveaux/port-high-resolution-clock';
