// libraries that the screens use as globals (they were classic <script> files before Vite)
import SunCalc from 'suncalc';
import NoSleep from 'nosleep.js';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'swiped-events';

window.SunCalc = SunCalc;
window.NoSleep = NoSleep;
// the Local Radar map: bundled, not loaded from a CDN at every start
window.L = L;
