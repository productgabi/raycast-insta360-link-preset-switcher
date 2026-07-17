# Changelog

All notable changes to this project are documented here. This project adheres to [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-07-17

Initial release.

### Added

- **Switch Webcam Preset** command — searchable list of saved framings; `Enter` moves the camera to the highlighted preset.
  - Save the camera's current pan/tilt/zoom as a new preset (`⌘N`), with a pickable icon.
  - Edit a preset's name and icon (`⌘E`), reorder (`⌘⌥↑/↓`), and delete (`⌃X`).
- **Apply Webcam Preset 1–5** commands — no-view commands that apply a preset by slot, each bindable to a global hotkey. The command subtitle updates to the applied preset's name.
- Camera control via [`uvc-util`](https://github.com/jtfrey/uvc-util) using standard UVC absolute pan/tilt/zoom controls.
- Captured framings are snapped to the camera's step grid so presets recall their position exactly.
- Preferences for the `uvc-util` binary path and camera device name.

[1.0.0]: https://github.com/productgabi/raycast-insta360-link-preset-switcher/releases/tag/v1.0.0
