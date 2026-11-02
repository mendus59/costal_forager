/**
 * What the home-screen widget shows. Everything is precomputed text and
 * colors, because widget layouts run in a separate runtime that cannot import
 * app code.
 */
export interface DayQualityProps {
  /** "Today", "Tomorrow" or "Sat, Nov 7". */
  when: string;
  /** "Great", "Good", "Marginal", "Poor", "Closed", or "" when there is nothing to show. */
  rating: string;
  /** Badge colors for the rating. */
  bg: string;
  fg: string;
  /** "Oysters" */
  species: string;
  /** "Potlatch State Park" */
  beach: string;
  /** "Low −1.8 ft at 9:42 AM" */
  detail: string;
  /** "Next great day: Sat, Nov 7" */
  next: string;
  /** Deep link the widget opens, such as coastalforager://beach/270440. */
  url: string;
}

export const EMPTY_WIDGET: DayQualityProps = {
  when: 'Today',
  rating: '',
  bg: '#7b8a90',
  fg: '#ffffff',
  species: '',
  beach: 'Star a beach',
  detail: 'Open Coastal Forager and star your favorite beaches to see their day here.',
  next: '',
  url: 'coastalforager://',
};
