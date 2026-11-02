/** Web has no home-screen widgets; this keeps the same API as a no-op. (A .tsx file so the .ios/.android files win on native.) */
import type { DayQualityProps } from './types';

const DayQuality = {
  updateSnapshot(_props: DayQualityProps): void {},
  updateTimeline(_entries: { date: Date; props: DayQualityProps }[]): void {},
  reload(): void {},
};

export default DayQuality;
