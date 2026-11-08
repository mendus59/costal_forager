/**
 * What the home-screen widget shows: one beach and one species the user
 * picked, colored by how well the day fits their saved preferences, with the
 * low tide time. Everything is precomputed text and colors, because widget
 * layouts run in a separate runtime that cannot import app code.
 */
export interface BeachTideProps {
  /** Day the color is for: "Today", "Tomorrow" or "Sat, Nov 7". */
  when: string;
  /** "Great", "Good", "Marginal", "Poor", "Closed", or "" before setup. */
  rating: string;
  /** Background and text colors for the rating. */
  bg: string;
  fg: string;
  /** "Oysters" */
  species: string;
  /** "Potlatch State Park" */
  beach: string;
  /** "9:42 AM": the best low in the user's hours, else the next low tide. */
  tideTime: string;
  /** "Best low −1.8 ft", "Next low +2.1 ft" or "Tomorrow low −1.2 ft". */
  tideLabel: string;
  /** Why the day rates as it does when it isn't usable, such as "WDFW season closed". */
  note: string;
  /** Deep link the widget opens. */
  url: string;
}

export const EMPTY_BEACH_TIDE: BeachTideProps = {
  when: '',
  rating: '',
  bg: '#7b8a90',
  fg: '#ffffff',
  species: '',
  beach: 'Star a beach',
  tideTime: '',
  tideLabel: '',
  note: 'Tap to open Coastal Forager and pick a beach.',
  url: 'coastalforager://settings',
};
