# Penalties Setup

A static web page that builds the airline **Penalties Export** Excel file in the exact Template format.

1. Set the Before / After penalties (Modification in orange, Refund in red, each as Value or Percentage) and the currency.
2. Pick one or more fare classes and one or more legs.
3. Add them to the file, then export `.xlsx` (sheets: `Penalties` and `ReferenceValues`, with the same VLOOKUP code columns).

Fixed values: Action `Update`, Penalty Type `Classic`, Application Type `By coupon`, period 0 to 10000 hours. Adult and Child get the same penalty; Infant rows are optional (zero penalty).

No build step and no backend: open `index.html` or host it on GitHub Pages. Reference codes are embedded in the page; currencies are set in `ENABLED_CURRENCIES`.

Yaser Aljaali - ياسر الجعلي
