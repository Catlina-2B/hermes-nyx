# Hermes WebUI AI Handover

This document is for future AI agents and developers working in this repository.

## Project Shape

Hermes WebUI is a Vite + React frontend with a FastAPI backend.

- Frontend root: `frontend/`
- Backend root: `backend/`
- Dev frontend port: `5173`
- Backend target used by Vite proxy: `8081`
- Chat transport: WebSocket `/ws/chat`
- Static frontend assets: `frontend/public/`

The repo already has many uncommitted files. Do not reset or revert unrelated work.

## VRM Digital Human Plugin

The digital human is implemented as a frontend plugin, not as a hardcoded sidebar component.

Main files:

- `frontend/src/plugins/registry.ts`
  - Registers frontend plugins.
- `frontend/src/plugins/types.ts`
  - Defines the plugin contract.
- `frontend/src/plugins/chatDirectives.ts`
  - Parses hidden `[expr:{...}]` directives from streamed assistant text.
- `frontend/src/plugins/vrm-digital-human/index.tsx`
  - Plugin entry.
- `frontend/src/plugins/vrm-digital-human/DigitalHumanPanel.tsx`
  - Draggable transparent VRM overlay.
- `frontend/src/plugins/vrm-digital-human/vrm/`
  - VRM renderer, pose presets, expression mapping, hand-pose templates.
  - `holo-coding.ts` contains the Three.js holographic keyboard/code-screen effect for the `coding` pose.
- `backend/plugins/vrm_digital_human.py`
  - Backend prompt fragment that teaches the Hermes agent to emit hidden VRM directives.

`frontend/src/App.tsx` creates a `chatDirectiveRef`, passes it to `useChat`, and renders plugin overlays from `frontendPlugins`.

## Current UI Behavior

The VRM character is:

- Fixed-position overlay.
- Default positioned at the lower-right of the viewport.
- Transparent: no panel background, no border, no title bar.
- Draggable by pressing and dragging anywhere inside the character overlay.
- Clamped inside the browser viewport.

The current default overlay dimensions are in `DigitalHumanPanel.tsx`:

- Width: `240px`
- Height: `340px`

The canvas scene background is transparent. This is set in:

```ts
frontend/src/plugins/vrm-digital-human/vrm/renderer.ts
```

Do not re-add a title bar, visible drag handle, border, card background, or panel chrome unless the user explicitly asks.

## Current Model

The active model is:

```text
frontend/public/models/yueyue.vrm
```

The plugin default path is:

```ts
modelPath = "/models/yueyue.vrm"
```

This is set in:

```ts
frontend/src/plugins/vrm-digital-human/DigitalHumanPanel.tsx
```

Another available model:

```text
frontend/public/models/yueyue-2.vrm
```

To switch models, copy the `.vrm` file into `frontend/public/models/` and change the plugin default `modelPath`.

Important renderer note:

- The current models face the camera correctly without root rotation.
- Do not set `vrm.scene.rotation.y = Math.PI` in this Hermes plugin renderer for the current model; screenshot validation shows neutral root rotation faces the camera.

## Chat Directive Contract

The assistant may emit hidden animation tags:

```text
[expr:{"happy":0.45,"pose":"wave"}]你好呀！
```

The frontend strips the tag from visible chat text and forwards the parsed JSON to the plugin through `chatDirectiveRef`.

Supported single-pose shape:

```json
{"happy":0.45,"pose":"wave"}
```

Supported motion timeline shape:

```json
{
  "motion": {
    "beats": [
      {"t": 0, "pose": "dance_twist_l", "expr": {"happy": 0.45}},
      {"t": 0.55, "pose": "dance_twist_r", "expr": {"happy": 0.45}},
      {"t": 1.1, "pose": "victory", "expr": {"happy": 0.55}}
    ]
  }
}
```

Rules currently expected by the plugin:

- `t` is seconds from sequence start.
- Beats are clamped to 0-5 seconds.
- Only the first 8 beats are used.
- Each beat may include `pose` and/or `expr`.
- The parser also accepts `sequence` or `steps` as aliases for `beats`.
- The directive may also use `choreo` or `choreography` instead of `motion`.

## Pose Names

Useful available pose names include:

```text
natural
bow
hands_on_hips
hands_behind
hands_front
arms_crossed
wave
angry_pose
shy
cheer
giggle
salute
pointing
embrace
shrug
pray
thinking
confident
sassy
cute_tilt
victory
stretch
fight_stance
sitting_crossed_legs
right_one
right_victory
right_three
right_four
right_five
dance_twist_l
dance_twist_r
coding
```

Hand/finger templates live in:

```text
frontend/src/plugins/vrm-digital-human/vrm/hand-poses.ts
```

Do not hand-write finger rotations in chat prompt output. Use named poses like `right_victory`, `right_five`, or `fight_stance`.

Use `coding` whenever the assistant's visible reply contains code-oriented content, including fenced code blocks, inline commands, config snippets, file paths plus code edits, terminal commands, or programming syntax explanations. For code-heavy answers, keep the character in `coding` for the whole answer instead of switching to unrelated expressive poses.

`coding` is a special effect pose. In addition to the body pose, `DigitalHumanPanel.tsx` shows `HoloCoding`, updates its animated keyboard/code-screen textures, and animates the index/middle fingers as typing keys. The effect is mounted on the Three.js scene exposed by `VRMRenderer.getScene()`.

## Backend Prompt Integration

`backend/chat_manager.py` creates `AIAgent` and passes:

```py
ephemeral_system_prompt=VRM_DIGITAL_HUMAN_PROMPT
```

The prompt itself is in:

```text
backend/plugins/vrm_digital_human.py
```

After editing backend prompt code, restart the backend. Existing agent instances may keep the old prompt until recreated.

## Validation

Frontend build:

```bash
cd ./frontend
npm run build
```

Backend syntax check:

```bash
cd .
python3 -m py_compile backend/chat_manager.py backend/plugins/vrm_digital_human.py backend/main.py
```

Visual checks previously performed:

- The model renders at lower-right.
- The overlay has no visible border/background/title.
- Dragging anywhere in the character overlay moves it.
- The current `yueyue.vrm` long-haired model loads.

Known unrelated dev-server issue:

- If backend is not running or misconfigured, the frontend can show WebSocket/API 500 errors.
- That does not necessarily mean the VRM model failed to load.

## Design Direction

Keep the digital human isolated as a plugin:

- The host app owns chat layout, logs, todos, and sessions.
- The plugin owns VRM rendering, pose execution, expression handling, and model assets.
- The shared boundary is `chatDirectiveRef` plus hidden `[expr:{...}]` directives.

Future improvements should preserve that boundary:

- Add plugin config for model path instead of hardcoding it.
- Add a model selector only if requested.
- Lazy-load the VRM plugin if bundle size becomes a problem.
- Add screenshot-based pose validation before changing pose or hand templates.
