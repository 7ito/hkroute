# HK Route

[![ClawHub](https://img.shields.io/badge/ClawHub-7ito%2Fhkroute-blue)](https://clawhub.ai/7ito/hkroute)

Smart public transport routing for Hong Kong with real-time bus ETAs.

Combines Google Maps transit directions with live bus arrival times from [hk-bus-eta](https://github.com/nicanderhery/hk-bus-eta), then ranks routes by **effective total time** (real wait + travel duration) instead of schedule data alone.

## How it works

1. Queries Google Maps Directions API for transit alternatives
2. Matches each bus leg to the [hk-bus-eta](https://github.com/nicanderhery/hk-bus-eta) stop database (geodesic matching within 500m)
3. Fetches real-time ETAs for matched stops
4. Ranks routes by `wait_time + travel_duration` and returns the top 4

## Installation

### From ClawHub

```bash
npx clawhub@latest install 7ito/hkroute
```

### Manual (OpenClaw / Claude Code skill)

The `skill/` directory is self-contained and ready to use as an [OpenClaw](https://openclaw.org) skill (also compatible with [Claude Code skills](https://docs.anthropic.com/en/docs/claude-code/skills)):

```
skill/
  SKILL.md          # Skill definition (triggers, prompt, output format)
  scripts/
    hk-route.cjs    # Bundled CLI — no npm install needed, just Node >= 18
```

Copy or symlink `skill/` into your skills directory.

Both methods require `GOOGLE_MAPS_API_KEY` set in your environment.

## CLI usage

```bash
node skill/scripts/hk-route.cjs \
  --origin "Causeway Bay" \
  --destination "Stanley Market"
```

### Options

| Flag | Description |
|------|-------------|
| `--origin` | Starting location (place name or `lat,lng`) |
| `--destination` | Ending location (place name or `lat,lng`) |
| `--departure-time` | ISO 8601 datetime for future trips |

Place names are auto-qualified with ", Hong Kong" for geocoding. Coordinates use `lat,lng` format with no space after the comma.

### Output

JSON to stdout with up to 4 ranked routes. Each route contains legs (walk, bus, MTR, ferry, tram) with:

- Real-time ETAs for bus legs (when available)
- `actionable: true` on the first bus leg (the one that determines when to leave)
- `recommended: true` on the best route

## Development

```bash
npm install
npm test              # Unit tests (Node built-in test runner)
npm run build         # Bundle to skill/scripts/hk-route.cjs
npm start             # Run directly via tsx (dev)
```

### Architecture

```
src/
  index.ts        # CLI entry point & orchestration
  directions.ts   # Google Maps API client & vehicle classification
  eta.ts          # Real-time ETA fetching with 24h cache (~/.cache/hk-route/)
  matcher.ts      # Stop matching (agency mapping + geodesic distance)
  formatter.ts    # Route ranking & output formatting
  types.ts        # TypeScript interfaces
```

## Requirements

- Node.js >= 18
- `GOOGLE_MAPS_API_KEY` environment variable — a Google Maps API key with the **Directions API** and **Geocoding API** enabled. You can create one in the [Google Cloud Console](https://console.cloud.google.com/apis/credentials).

## License

[MIT-0](LICENSE)
