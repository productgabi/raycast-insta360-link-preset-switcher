import { getPreferenceValues, LocalStorage } from "@raycast/api";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

export interface Preset {
  id: string;
  name: string;
  /** A Raycast `Icon` enum key (e.g. "Camera"). Falls back to Camera when unset. */
  icon?: string;
  pan: number;
  tilt: number;
  zoom: number;
}

export interface Framing {
  pan: number;
  tilt: number;
  zoom: number;
}

interface Prefs {
  uvcUtilPath: string;
  cameraName: string;
}

const PRESETS_KEY = "presets";

// UVC pan/tilt are quantized to this step (arcseconds; 3600 ≈ 1°). Setting an
// off-grid value snaps to the nearest multiple, so we snap at capture time to
// guarantee a captured preset reproduces exactly when applied.
const PAN_TILT_STEP = 3600;
const PAN_RANGE = { min: -522000, max: 522000 };
const TILT_RANGE = { min: -324000, max: 360000 };
const ZOOM_RANGE = { min: 100, max: 400 };

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));
const snap = (v: number, step: number) => Math.round(v / step) * step;

export function getConfig(): Prefs {
  const { uvcUtilPath, cameraName } = getPreferenceValues<Prefs>();
  return {
    uvcUtilPath: (uvcUtilPath || "/usr/local/bin/uvc-util").trim(),
    cameraName: (cameraName || "Insta360 Link").trim(),
  };
}

/** Run uvc-util with the given args, returning stdout. Throws a readable error on failure. */
async function uvc(args: string[]): Promise<string> {
  const { uvcUtilPath } = getConfig();
  try {
    const { stdout } = await execFileP(uvcUtilPath, args, { timeout: 10_000 });
    return stdout;
  } catch (err) {
    const e = err as NodeJS.ErrnoException & { stderr?: string };
    if (e.code === "ENOENT") {
      throw new Error(
        `uvc-util not found at "${uvcUtilPath}". Set the correct path in extension preferences.`,
      );
    }
    throw new Error((e.stderr || e.message || String(err)).trim());
  }
}

/** Read the camera's current pan/tilt/zoom framing. */
export async function readCurrentFraming(): Promise<Framing> {
  const { cameraName } = getConfig();
  const [panTiltOut, zoomOut] = await Promise.all([
    uvc(["-N", cameraName, "-g", "pan-tilt-abs"]),
    uvc(["-N", cameraName, "-g", "zoom-abs"]),
  ]);

  // Expected: "pan-tilt-abs = {pan=-7200,tilt=-40680}"
  const panMatch = panTiltOut.match(/pan\s*=\s*(-?\d+)/);
  const tiltMatch = panTiltOut.match(/tilt\s*=\s*(-?\d+)/);
  // Expected: "zoom-abs = 110"
  const zoomMatch =
    zoomOut.match(/zoom-abs\s*=\s*(\d+)/) || zoomOut.match(/(-?\d+)\s*$/m);

  if (!panMatch || !tiltMatch || !zoomMatch) {
    throw new Error(
      `Could not parse camera position from uvc-util output.\n${panTiltOut}\n${zoomOut}`,
    );
  }

  return {
    pan: clamp(
      snap(parseInt(panMatch[1], 10), PAN_TILT_STEP),
      PAN_RANGE.min,
      PAN_RANGE.max,
    ),
    tilt: clamp(
      snap(parseInt(tiltMatch[1], 10), PAN_TILT_STEP),
      TILT_RANGE.min,
      TILT_RANGE.max,
    ),
    zoom: clamp(parseInt(zoomMatch[1], 10), ZOOM_RANGE.min, ZOOM_RANGE.max),
  };
}

/** Move the camera to the given framing. */
export async function applyFraming(framing: Framing): Promise<void> {
  const { cameraName } = getConfig();
  // Pan/tilt first, then zoom.
  await uvc([
    "-N",
    cameraName,
    "-s",
    `pan-tilt-abs={pan=${framing.pan},tilt=${framing.tilt}}`,
  ]);
  await uvc(["-N", cameraName, "-s", `zoom-abs=${framing.zoom}`]);
}

export async function loadPresets(): Promise<Preset[]> {
  const raw = await LocalStorage.getItem<string>(PRESETS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Preset[]) : [];
  } catch {
    return [];
  }
}

export async function savePresets(presets: Preset[]): Promise<void> {
  await LocalStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

/** Generate a reasonably unique id without Date.now/Math.random dependence being critical. */
export function newId(): string {
  return `p_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/** Apply the preset stored in slot n (1-based). Used by the hotkey slot commands. */
export async function applySlot(n: number): Promise<Preset> {
  const presets = await loadPresets();
  const preset = presets[n - 1];
  if (!preset) {
    throw new Error(
      `No preset in slot ${n}. Add one in the "Switch Preset" command.`,
    );
  }
  await applyFraming(preset);
  return preset;
}
