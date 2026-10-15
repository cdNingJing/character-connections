import { createJourneyDocument } from './journey.ts';
export { DEMO_STAGES, createJourneyDocument } from './journey.ts';

/** Compatibility wrapper for the initial public source API. */
export function createExampleDocument(complex = false) {
  return createJourneyDocument(complex ? 3 : 1);
}
