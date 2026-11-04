// Extends app.json. EXPO_BASE_URL sets the URL path the web build is served
// from, e.g. "/costal_forager" for GitHub Pages project sites. Unset for
// native builds and local development, which serve from the root.
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...config.experiments,
    baseUrl: process.env.EXPO_BASE_URL || undefined,
  },
});
