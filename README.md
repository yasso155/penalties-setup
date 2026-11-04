# Penalties Setup

A static web page that builds the airline **Penalties Export** Excel file in the exact Template format.

1. Set the Before / After penalties (Modification in orange, Refund in red, each as Value or Percentage) and the currency.
2. Pick one or more fare classes and one or more legs.
3. Add them to the file, then export `.xlsx` (sheets: `Penalties` and `ReferenceValues`, with the same VLOOKUP code columns).

Fixed values: Penalty Type `Classic`, Application Type `By coupon`, Classic rows cover 0 to 10000 hours (Before and After). NoShow rows are Before only, 0 to 0 hours, like the real export. Adult and Child get the same penalty; Infant rows are optional (zero penalty).

Action and ID: import an existing export file (the Penalties sheet with IDs). A row that matches an existing penalty (Penalty Type, Farebasis, Leg, Passenger, Before/After, hours, Currency) becomes `Update` with its ID. Any other row becomes `Add` with no ID. The current Modification and Refund values are stored too, so each row is shown as Changed, Same or New, with the old value next to the new one.

Each import is saved in the browser and merged into the stored table: values in the new file overwrite the old ones, other penalties stay.

Built-in penalties: if `data/penalties.json` exists next to the page, it is loaded on start as the ID table (no import needed). It is not committed here because this repo is public and the file holds real fare data.

No build step and no backend: open `index.html` or host it on GitHub Pages. Reference codes are embedded in the page; currencies are set in `ENABLED_CURRENCIES`.

Yaser Aljaali - ياسر الجعلي

## Firebase setup (multi-user)

1. In the [Firebase Console](https://console.firebase.google.com) create a project.
2. **Authentication** > Sign-in method > enable **Email/Password**, then add your users under *Users*.
3. **Firestore Database** > Create database (production mode), then paste `firestore.rules` in the *Rules* tab and publish.
4. **Project settings** > *Your apps* > add a **Web app**, copy the config into `firebase-config.js`.
5. **Authentication** > Settings > *Authorized domains* > add `yasso155.github.io`.
6. Enable GitHub Pages for this repo (Settings > Pages > Deploy from branch `main`).

Data layout: `existing/chunk-N` (shared penalty IDs and current values), `settings/main` (SDG rates), `drafts/{uid}` (each user's own selections and file).
While `firebase-config.js` is empty the page works in local mode (browser storage only).
