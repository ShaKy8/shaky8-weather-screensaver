# ShaKy8 weather screensaver

An Omarchy screensaver that alternates the ShaKy8 logo (the `ttfx` text effect) with live
[ATMOS//NET](https://branyontech.com/weather/) weather screens.

> **Status (2026-11-06):** currently uninstalled on this machine. The stock Omarchy
> screensaver is in use (showing the ShaKy8 text from
> `~/.config/omarchy/branding/screensaver.txt`), and the idle timers in
> `~/.config/omarchy/shell.json` are back at stock (screensaver after 150 s, lock after
> 300 s). Run `./install.sh` to bring this back.

## What it does

Each time the screensaver starts it opens on the logo, then loops:

1. Logo for about 20 seconds (one or more random `ttfx` effects).
2. A fullscreen Chromium window showing the live weather site at your current location,
   stepping through **Deck, Radar**, 60 seconds each.
3. Back to the logo.

Any key press or mouse movement exits, in both the logo and weather phases. If the site
can't be reached (offline or down), it stays on the logo and checks again each cycle.

## How it works

Omarchy's `omarchy-screensaver` calls `ttfx` once per logo effect. `shaky8-ttfx` is installed as
`~/.local/bin/ttfx`, which comes before `/usr/bin` on that script's PATH, so it decides what
each call shows: one real `ttfx` effect, or a weather cycle. A `ttfx` not started by
`omarchy-screensaver` passes straight through to `/usr/bin/ttfx`.

The weather cycle launches Chromium in kiosk mode with its own profile
(`~/.cache/shaky8-screensaver/chromium`), separate from your normal browser. It is given the
screensaver's window class so Omarchy's fullscreen rule applies. `shaky8-weather-driver.mjs`
controls it over the DevTools protocol: it grants geolocation, switches views through the
page's `#deck`/`#radar`/`#sky`/`#air`/`#data`/`#overhead` links, and reports any key or mouse input so the
screensaver can quit. The site saves the detected location in that profile.

Nothing under `/usr` is edited, so Omarchy updates don't overwrite it. The one dependency is
that Omarchy's script keeps calling `ttfx` the same way.

## Files

| File | Purpose |
|---|---|
| `shaky8-ttfx` | The `ttfx` wrapper; installed to `~/.local/bin/ttfx` |
| `shaky8-weather-driver.mjs` | Drives Chromium; installed to `~/.local/share/shaky8-screensaver/` |
| `install.sh` | Installs or removes the above |

## Install

```
./install.sh
```

Requires `chromium`, `node`, `curl`, `jq`, `hyprctl`, and `/usr/bin/ttfx`; it stops with a
message if one is missing. It copies the two files above into place and touches nothing else.

Test it with `omarchy-launch-screensaver force`.

Re-run `./install.sh` after editing `shaky8-ttfx` or the driver so the installed copies match.

## Uninstall

```
./install.sh --uninstall
```

Removes `~/.local/bin/ttfx`, `~/.local/share/shaky8-screensaver/`, and
`~/.cache/shaky8-screensaver/` (which includes the Chromium profile and the saved location).
The stock Omarchy screensaver is back immediately.

## Settings

Set at the top of `shaky8-ttfx` (the `${SHAKY8_*:-default}` lines), or as environment
variables where the script runs. The launcher does not pass your shell's variables to the
screensaver, so edit the defaults in the file and re-run `./install.sh`.

| Setting | Default | Meaning |
|---|---|---|
| `SHAKY8_URL` | `https://branyontech.com/weather/` | Weather site to show |
| `SHAKY8_SEQUENCE` | `deck:60 radar:60` | Space-separated `view:seconds` steps, in order. The six views are `deck`, `radar`, `sky`, `air`, `data`, and `overhead` (the site's Above tab) |
| `SHAKY8_LOGO_SECS` | `20` | Minimum logo time between weather cycles. Effects run to completion, so a phase can overrun by up to about 10 seconds |
| `SHAKY8_PORT` | `9337` | Chromium DevTools port, if something else uses it |
| `SHAKY8_DRIVER` | `~/.local/share/shaky8-screensaver/shaky8-weather-driver.mjs` | Path to the driver script |

## Debug log

```
touch ~/.cache/shaky8-screensaver/debug     # turn on
rm ~/.cache/shaky8-screensaver/debug        # turn off
```

While the file exists, every `ttfx` call made by the screensaver writes a shell trace to
`~/.cache/shaky8-screensaver/log`. The driver also logs which input event ended a weather
phase (for example `input: keydown key=...`). The log grows with every run, so turn it off
when you're done.

## Location

The site picks up your location through the browser the first time it runs and saves it in
the screensaver's Chromium profile. If you move, delete `~/.cache/shaky8-screensaver/chromium`
and it will detect the new place on the next run.
