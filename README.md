# Penalties Setup

A static web page that builds the airline **Penalties Export** Excel file in the exact Template format.

1. Set the Before / After penalties (Modification in orange, Refund in red, each as Value or Percentage) and the currency.
2. Pick one or more fare classes and one or more legs.
3. Add them to the file, then export `.xlsx` (sheets: `Penalties` and `ReferenceValues`, with the same VLOOKUP code columns).

Fixed values: Penalty Type `Classic`, Application Type `By coupon`, Classic rows cover 0 to 10000 hours (Before and After). NoShow rows are Before only, 0 to 0 hours, like the real export. Adult and Child get the same penalty; Infant rows are optional (zero penalty).

Action and ID: import an existing export file (the Penalties sheet with IDs). A row that matches an existing penalty (Penalty Type, Farebasis, Leg, Passenger, Before/After, hours, Currency) becomes `Update` with its ID. Any other row becomes `Add` with no ID. The current Modification and Refund values are stored too, so each row is shown as Changed, Same or New, with the old value next to the new one.

Built-in penalties: if `data/penalties.json` exists next to the page, it is loaded on start as the ID table (no import needed). It is not committed here because this repo is public and the file holds real fare data.

No build step and no backend: open `index.html` or host it on GitHub Pages. Reference codes are embedded in the page; currencies are set in `ENABLED_CURRENCIES`.

Yaser Aljaali - ياسر الجعلي
