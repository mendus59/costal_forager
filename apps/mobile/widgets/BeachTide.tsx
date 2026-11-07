/** Web has no home-screen widgets; this keeps the same API as a no-op. (A .tsx file so the .ios/.android files win on native.) */
import type { BeachTideProps } from './types';

const BeachTide = {
  updateSnapshot(_props: BeachTideProps): void {},
  updateTimeline(_entries: { date: Date; props: BeachTideProps }[]): void {},
  reload(): void {},
};

export default BeachTide;
