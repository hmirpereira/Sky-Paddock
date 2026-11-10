[Back to the README](../README.md)

# Fixes to the original

- Auto refresh never started when a display stayed in "loading" (e.g. Hazards) or after a failed data request.
- The Hazards screen was never hidden, which stalled the rotation as soon as there was a warning.
- "Last Update" always showed "(none)".
- Missing weather icons: fog, freezing drizzle and rain, hail and violent rain showers.
- Times follow the "Hours Format" setting everywhere (Hourly Forecast, Almanac, Radar).
- The GPS (current location) button still expected a reply from the US weather service (NOAA) and stalled; it now turns the coordinates into a place name (ArcGIS reverse geocoding) and asks to type a city when the browser gives no position.
- The full screen button did nothing on phones: it looked for one spelling of the browser's API (missing the standard one) and gave no way out where there is none (Safari on the iPhone cannot take a page element full screen). It now tries every spelling and, where the browser has none or refuses, the screen fills the browser window instead (`utils/fullscreen.mjs`); a touch brings the controls back. Safari on the iPhone cannot hide its bars from a page, so there the button only fills the window and shows a note: for the whole screen, add the page to the Home Screen and open it from the icon (no Safari bars).
- The menu button with no location chosen drew the progress screen under the start screen; it now focuses the search box.
- Experimental Features removed (the nearby-cities lookup for Air Quality and Local Radar and its third-party proxy): slow, unreliable and of little use in Portugal.
- Image preloads resolve relative to the page.
- The loading screen lists every screen that is switched on (Hazards, Travel Forecast and Regional Forecast too, so any of them can be opened from there), in smaller lines when there are many.
- Browser icon and web app manifest: the icon link carries the version, and the manifest paths are relative to the site.

Removed from the original: Latest Observations and the United States city and station lists (1.5.5), the Personal Weather Station screen with its Express server and Docker files (1.6.1), the Local Forecast text screen (1.10.1).
- Marine Forecast removed (1.31.0), with its wind and wave height unit settings: it was off on the TV and about 400 lines of code and styles. The Local Radar map library (Leaflet) is now bundled with the site instead of loaded from unpkg.com at every start.

