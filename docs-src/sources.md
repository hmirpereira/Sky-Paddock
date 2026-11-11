[Back to the README](../README.md)

# Sources and limits

Every outside source the screens or the Pi service ask, how often, what limits it has, and what happens when it refuses. Everything is public data or used with the owner's own free account; keys live only in the Pi's configuration. Details of each screen are in [the screen pages](screens/).

## Asked by the page (the browser)

| Source | Used by | How often and limits | When it refuses |
|---|---|---|---|
| [Open-Meteo](https://open-meteo.com) (also CAMS for air and pollen) | Weather screens, Air & Pollen, forecasts at F1 and GT circuits | Forecasts in one request per screen where the README says so | |
| [Esri ArcGIS Online](https://server.arcgisonline.com) | Local Radar | The base map and the names and borders over it, one set of tiles per start | The rain is drawn on the background alone |
| [IPMA](https://api.ipma.pt) | Hazards | Warnings for one district | Hazards is skipped when there are none |
| [RainViewer](https://www.rainviewer.com) | Local Radar | Precipitation radar | |
| [metar.vatsim.net](https://metar.vatsim.net) | Airport METAR | One airport | |
| [Jolpica F1](https://github.com/jolpica/jolpica-f1) | F1 screens | Standings and results; Drivers and Next Race once a day, Friday to Monday after 22:00 Lisbon time, then kept in `localStorage` | Falls back to OpenF1 for sessions Jolpica has not published |
| [OpenF1](https://openf1.org) | F1 Telemetry, F1 Last Race and Grid when Jolpica is late | One queue for all F1 screens, one request at a time and spaced. Telemetry looks for a newer session at most once an hour, 30 minutes after a session ends | Refuses free requests while a session is live and answers 429 when requests come too close together |
| [OpenStreetMap](https://www.openstreetmap.org) tiles | Overhead radar | Once per start | Radar is drawn without the map |

## Asked by the Pi service (`skypaddock-hub`)

| Source | Used by | How often and limits | When it refuses |
|---|---|---|---|
| [adsb.fi](https://adsb.fi) | Overhead, Verstappen Jet | Overhead every 5 minutes; the jet once an hour and every 5 minutes while it flies. No daily quota, 1 request a second, personal non-commercial use, cited on the screen | A source that refuses is left alone for 6 hours |
| [adsb.lol](https://adsb.lol) | Overhead (backup) | 500 requests a day per address | Has refused the Pi since 2 November 2026 ("banned"); a 403 or 429 is left alone for 6 hours. Its track files are behind a verification page: not worked around, asked again only every 6 hours |
| [airplanes.live](https://airplanes.live) | Verstappen Jet | Only when adsb.fi does not see the jet | Next source in the order |
| [AvioADSB](https://avioadsb.org) | Verstappen Jet | Owner's free key `AVIOADSB_KEY`, 10,000 requests a month, so only when the other two do not see the jet. CC BY-NC 4.0, cited on the screen | A 429 or a server error pauses it for 10 minutes; its failures are not shown as an error of the jet |
| [The OpenSky Network](https://opensky-network.org) | Overhead (aircraft on the ground), Verstappen Jet (live state, flights, tracks) | Owner's free account; flights and tracks checked at start-up up to 30 days back and then every 6 hours | Without a track the map shows a straight line between the airports |
| [adsbdb](https://www.adsbdb.com) | Overhead | Routes by callsign | A route is shown only if the aircraft is near the line between origin and destination |
| [AeroDataBox](https://aerodatabox.com) | Departures, Cancellations, Overhead flight numbers, Verstappen Jet arrival | Private key; the monthly quota is spread over the days left. Jet arrival: one request per flight, a second 3 hours later if there was no answer, only for flights of the last 3 days, in the same quota as Departures | Without live data a flight shows SCHEDULED |
| [aviationweather.gov](https://aviationweather.gov) | TAF pages of Airport METAR | Through the Pi (`/taf.json`) | Does not accept browser requests, so the TAF is left out anywhere but the Pi |
| [FLIC](https://flic.tap.pt) (TAP's public flight information pages for OPO) | Work Schedule, Gates page (stand, ETA, departure time) | Only on days with gates (the owner's or anybody's), from 3 hours before the first flight to 1 hour after the last: arrivals every 5 minutes, departures every 15 (16 requests an hour at most) | After a 403 it is left alone for 6 hours, after another HTTP error 30 minutes; the page shows the flights without stand and ETA |
| [OurAirports](https://ourairports.com) | Airport names, Verstappen Jet airports | Monthly copy | |
| [Celebplanes](https://www.celebplanes.com) | Verstappen Jet (missing airports) | With its permission, once a day at most, and only while the last flight lacks an airport | Then AeroDataBox is asked |
| RSS feeds of RTP, Expresso, Publico, CNN Portugal, Aviacao TV, FlyingLapF1, F1PT, PlanetF1 | News | Every 10 minutes, conditional requests, so an unchanged feed is not downloaded again | The headline list simply does not change |
| [gt-world-challenge-europe.com](https://www.gt-world-challenge-europe.com) | GT World, GT World Next | Public pages, every 6 hours, every 30 minutes from Friday to Monday | If the site changes its pages, the screens are skipped |
| [r/F1Porn](https://www.reddit.com/r/F1Porn/) (public Atom feed) | F1 Photo | Two feed requests an hour; one download per Lisbon hour | The JSON is refused to anonymous clients and is not worked around |
| [Tautulli](https://tautulli.com) (on another Raspberry Pi at home, connected to Plex) | Plex Recommends, Plex Now Playing | Recommends every 30 minutes (every 5 after a failure); Now Playing kept for 15 seconds and asked by the page once a minute. Key `TAUTULLI_KEY` in the Pi's configuration | Screens are skipped; the Pi warning line adds `Plex stale since ...` after 3 hours |

## Rules that apply to all of them

- Do not scrape flightradar24, and do not spoof `Referer` or `Origin` or otherwise get round a site's protection (F1 Jet Tracker and Swiss Timing refuse such requests: that is accepted).
- Do not redistribute MultiViewer data.
- A failed request is repeated after 1, 2 and 5 seconds only for network errors and server errors of 500 or more (`utils/fetch.mjs`), never after a 4xx answer.
- Credits and licences are in the Credits section of the README.
