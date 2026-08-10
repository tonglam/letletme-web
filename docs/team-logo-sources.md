# Team logo sources

The local team-logo PNGs are derived from official Premier League club crest
resources so production pages do not depend on a third-party image host.

| Team          | Local asset                        | Official club page                                                | Official crest resource                                                 |
| ------------- | ---------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Coventry City | `public/images/team-logos/COV.png` | <https://www.premierleague.com/en/clubs/9/coventry-city/overview> | <https://resources.premierleague.com/premierleague25/badges/9.png>  |
| Hull City     | `public/images/team-logos/HUL.png` | <https://www.premierleague.com/en/clubs/88/hull-city/overview>    | <https://resources.premierleague.com/premierleague25/badges-alt/88.svg> |

All local crests sit on transparent **215×215** canvases. Each crest is
trimmed then scaled so its longer side is **200px** (centered), so badges
read at the same visual size in the UI.

Coventry uses the official colour PNG (not `badges-alt` SVG): the SVG export
fills most paths as black, which produced an unreadable near-black crest when
rasterised.
