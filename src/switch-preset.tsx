import {
  Action,
  ActionPanel,
  Color,
  confirmAlert,
  Form,
  Icon,
  Keyboard,
  List,
  showHUD,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { useEffect, useState } from "react";
import {
  applyFraming,
  loadPresets,
  newId,
  Preset,
  readCurrentFraming,
  savePresets,
} from "./lib/camera";

// Curated set of Raycast icons offered when picking a preset icon.
const ICON_CHOICES: (keyof typeof Icon)[] = [
  "Camera",
  "Video",
  "Monitor",
  "Desktop",
  "Window",
  "Person",
  "TwoPeople",
  "Microphone",
  "Livestream",
  "Book",
  "Pencil",
  "Brush",
  "Sun",
  "Moon",
  "Star",
  "Bookmark",
  "Map",
  "Mug",
  "GameController",
  "Dot",
];

const DEFAULT_ICON: keyof typeof Icon = "Camera";

function resolveIcon(key?: string): Icon {
  return key && key in Icon ? Icon[key as keyof typeof Icon] : Icon.Camera;
}

export default function Command() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function refresh() {
    setPresets(await loadPresets());
    setIsLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function persist(next: Preset[]) {
    setPresets(next);
    await savePresets(next);
  }

  async function apply(preset: Preset) {
    const toast = await showToast({
      style: Toast.Style.Animated,
      title: `Moving to ${preset.name}…`,
    });
    try {
      await applyFraming(preset);
      await showHUD(`📷 ${preset.name}`);
    } catch (err) {
      toast.style = Toast.Style.Failure;
      toast.title = "Failed to apply preset";
      toast.message = String(err instanceof Error ? err.message : err);
    }
  }

  async function remove(preset: Preset) {
    const confirmed = await confirmAlert({
      title: `Delete "${preset.name}"?`,
      icon: Icon.Trash,
      primaryAction: { title: "Delete" },
    });
    if (!confirmed) return;
    await persist(presets.filter((p) => p.id !== preset.id));
  }

  function move(preset: Preset, dir: -1 | 1) {
    const idx = presets.findIndex((p) => p.id === preset.id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= presets.length) return;
    const next = [...presets];
    [next[idx], next[target]] = [next[target], next[idx]];
    persist(next);
  }

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search presets…">
      <List.EmptyView
        icon={Icon.Camera}
        title="No presets yet"
        description="Frame your Insta360 Link (in the Insta360 app or manually), then capture it below."
        actions={
          <ActionPanel>
            <CaptureAction presets={presets} onSaved={refresh} />
          </ActionPanel>
        }
      />
      {presets.map((preset, i) => (
        <List.Item
          key={preset.id}
          icon={{ source: resolveIcon(preset.icon), tintColor: Color.Blue }}
          title={preset.name}
          subtitle={`pan ${preset.pan}  ·  tilt ${preset.tilt}  ·  zoom ${(preset.zoom / 100).toFixed(2)}×`}
          accessories={
            i < 5
              ? [
                  {
                    tag: { value: `slot ${i + 1}`, color: Color.SecondaryText },
                  },
                ]
              : []
          }
          actions={
            <ActionPanel>
              <ActionPanel.Section>
                <Action
                  title="Apply Preset"
                  icon={Icon.Play}
                  onAction={() => apply(preset)}
                />
                <CaptureAction presets={presets} onSaved={refresh} />
              </ActionPanel.Section>
              <ActionPanel.Section>
                <EditAction
                  preset={preset}
                  presets={presets}
                  onSaved={refresh}
                />
                <Action
                  title="Move up"
                  icon={Icon.ArrowUp}
                  shortcut={{ modifiers: ["cmd", "opt"], key: "arrowUp" }}
                  onAction={() => move(preset, -1)}
                />
                <Action
                  title="Move Down"
                  icon={Icon.ArrowDown}
                  shortcut={{ modifiers: ["cmd", "opt"], key: "arrowDown" }}
                  onAction={() => move(preset, 1)}
                />
                <Action
                  title="Delete Preset"
                  icon={Icon.Trash}
                  style={Action.Style.Destructive}
                  shortcut={{ modifiers: ["ctrl"], key: "x" }}
                  onAction={() => remove(preset)}
                />
              </ActionPanel.Section>
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}

function IconDropdown({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Form.Dropdown id="icon" title="Icon" value={value} onChange={onChange}>
      {ICON_CHOICES.map((key) => (
        <Form.Dropdown.Item
          key={key}
          value={key}
          title={key}
          icon={Icon[key]}
        />
      ))}
    </Form.Dropdown>
  );
}

function CaptureAction({
  presets,
  onSaved,
}: {
  presets: Preset[];
  onSaved: () => void;
}) {
  const { push } = useNavigation();
  return (
    <Action
      title="Save Current Position as Preset"
      icon={Icon.Plus}
      shortcut={Keyboard.Shortcut.Common.New}
      onAction={() => push(<CaptureForm presets={presets} onSaved={onSaved} />)}
    />
  );
}

function CaptureForm({
  presets,
  onSaved,
}: {
  presets: Preset[];
  onSaved: () => void;
}) {
  const { pop } = useNavigation();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<string>(DEFAULT_ICON);
  const [error, setError] = useState<string | undefined>();

  async function submit() {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    const toast = await showToast({
      style: Toast.Style.Animated,
      title: "Reading camera position…",
    });
    try {
      const framing = await readCurrentFraming();
      const preset: Preset = {
        id: newId(),
        name: name.trim(),
        icon,
        ...framing,
      };
      await savePresets([...presets, preset]);
      toast.style = Toast.Style.Success;
      toast.title = `Saved "${preset.name}"`;
      onSaved();
      pop();
    } catch (err) {
      toast.style = Toast.Style.Failure;
      toast.title = "Could not read camera";
      toast.message = String(err instanceof Error ? err.message : err);
    }
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Capture Preset"
            icon={Icon.Camera}
            onSubmit={submit}
          />
        </ActionPanel>
      }
    >
      <Form.Description text="Captures the camera's current pan/tilt/zoom into a new preset. Tip: set the framing you want in the Insta360 app first, then capture it here." />
      <Form.TextField
        id="name"
        title="Preset Name"
        placeholder="e.g. Meeting, Wide, Whiteboard"
        value={name}
        error={error}
        onChange={(v) => {
          setName(v);
          if (error) setError(undefined);
        }}
      />
      <IconDropdown value={icon} onChange={setIcon} />
    </Form>
  );
}

function EditAction({
  preset,
  presets,
  onSaved,
}: {
  preset: Preset;
  presets: Preset[];
  onSaved: () => void;
}) {
  const { push } = useNavigation();
  return (
    <Action
      title="Edit Preset"
      icon={Icon.Pencil}
      shortcut={Keyboard.Shortcut.Common.Edit}
      onAction={() =>
        push(<EditForm preset={preset} presets={presets} onSaved={onSaved} />)
      }
    />
  );
}

function EditForm({
  preset,
  presets,
  onSaved,
}: {
  preset: Preset;
  presets: Preset[];
  onSaved: () => void;
}) {
  const { pop } = useNavigation();
  const [name, setName] = useState(preset.name);
  const [icon, setIcon] = useState<string>(preset.icon ?? DEFAULT_ICON);
  const [error, setError] = useState<string | undefined>();

  async function submit() {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    await savePresets(
      presets.map((p) =>
        p.id === preset.id ? { ...p, name: name.trim(), icon } : p,
      ),
    );
    onSaved();
    pop();
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Save Changes"
            icon={Icon.Check}
            onSubmit={submit}
          />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="name"
        title="Preset Name"
        value={name}
        error={error}
        onChange={(v) => {
          setName(v);
          if (error) setError(undefined);
        }}
      />
      <IconDropdown value={icon} onChange={setIcon} />
    </Form>
  );
}
