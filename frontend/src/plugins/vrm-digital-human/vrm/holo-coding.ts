import * as THREE from 'three';

// 代码片段（用于滚动显示）
const CODE_LINES = [
  { color: '#6272a4', text: '// Initialize neural network pipeline' },
  { color: '#ff79c6', text: 'import' },{ color: '#f8f8f2', text: ' { ModelConfig, LayerSpec } ' },{ color: '#ff79c6', text: 'from' },{ color: '#f1fa8c', text: " '@core/nn'" },
  { color: '#f8f8f2', text: '' },
  { color: '#ff79c6', text: 'interface' },{ color: '#8be9fd', text: ' TransformBlock' },{ color: '#f8f8f2', text: ' {' },
  { color: '#f8f8f2', text: '  attention: ' },{ color: '#8be9fd', text: 'MultiHeadAttention' },
  { color: '#f8f8f2', text: '  feedForward: ' },{ color: '#8be9fd', text: 'FeedForward' },
  { color: '#f8f8f2', text: '  layerNorm: ' },{ color: '#8be9fd', text: 'LayerNorm' },
  { color: '#f8f8f2', text: '}' },
  { color: '#f8f8f2', text: '' },
  { color: '#ff79c6', text: 'async function' },{ color: '#50fa7b', text: ' buildModel' },{ color: '#f8f8f2', text: '(config: ' },{ color: '#8be9fd', text: 'ModelConfig' },{ color: '#f8f8f2', text: ') {' },
  { color: '#f8f8f2', text: '  const layers: ' },{ color: '#8be9fd', text: 'LayerSpec[]' },{ color: '#f8f8f2', text: ' = []' },
  { color: '#ff79c6', text: '  for' },{ color: '#f8f8f2', text: ' (let i = 0; i < config.depth; i++) {' },
  { color: '#f8f8f2', text: '    const block = ' },{ color: '#ff79c6', text: 'await' },{ color: '#50fa7b', text: ' createBlock' },{ color: '#f8f8f2', text: '({' },
  { color: '#f8f8f2', text: '      heads: config.numHeads,' },
  { color: '#f8f8f2', text: '      dim: config.hiddenDim,' },
  { color: '#f8f8f2', text: '      dropout: ' },{ color: '#bd93f9', text: '0.1' },{ color: '#f8f8f2', text: ',' },
  { color: '#f8f8f2', text: '    })' },
  { color: '#f8f8f2', text: '    layers.push(block)' },
  { color: '#f8f8f2', text: '  }' },
  { color: '#ff79c6', text: '  return' },{ color: '#50fa7b', text: ' compile' },{ color: '#f8f8f2', text: '(layers, config.optimizer)' },
  { color: '#f8f8f2', text: '}' },
  { color: '#f8f8f2', text: '' },
  { color: '#6272a4', text: '// Training loop with gradient accumulation' },
  { color: '#ff79c6', text: 'export async function' },{ color: '#50fa7b', text: ' train' },{ color: '#f8f8f2', text: '(model: ' },{ color: '#8be9fd', text: 'Model' },{ color: '#f8f8f2', text: ') {' },
  { color: '#f8f8f2', text: '  let totalLoss = ' },{ color: '#bd93f9', text: '0' },
  { color: '#ff79c6', text: '  for await' },{ color: '#f8f8f2', text: ' (const batch of dataLoader) {' },
  { color: '#f8f8f2', text: '    const { loss, grads } = model.forward(batch)' },
  { color: '#f8f8f2', text: '    totalLoss += loss.item()' },
  { color: '#f8f8f2', text: '    optimizer.step(grads)' },
  { color: '#f8f8f2', text: '  }' },
  { color: '#f8f8f2', text: '}' },
];

// 把 CODE_LINES 合并成完整行
function buildCodeLines(): { text: string; colors: { start: number; end: number; color: string }[] }[] {
  const lines: { text: string; colors: { start: number; end: number; color: string }[] }[] = [];
  let currentLine = { text: '', colors: [] as { start: number; end: number; color: string }[] };

  for (const segment of CODE_LINES) {
    if (segment.text === '') {
      lines.push(currentLine);
      currentLine = { text: '', colors: [] };
      continue;
    }
    if (segment.text.includes('\n')) {
      const parts = segment.text.split('\n');
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i] ?? '';
        const start = currentLine.text.length;
        currentLine.text += part;
        if (part.length > 0) {
          currentLine.colors.push({ start, end: currentLine.text.length, color: segment.color });
        }
        if (i < parts.length - 1) {
          lines.push(currentLine);
          currentLine = { text: '', colors: [] };
        }
      }
    } else {
      const start = currentLine.text.length;
      currentLine.text += segment.text;
      currentLine.colors.push({ start, end: currentLine.text.length, color: segment.color });
    }
  }
  if (currentLine.text.length > 0) lines.push(currentLine);
  return lines;
}

const KEYBOARD_ROWS = [
  '`1234567890-=',
  'QWERTYUIOP[]',
  'ASDFGHJKL;\'',
  'ZXCVBNM,./',
];

export class HoloCoding {
  private keyboard: THREE.Mesh;
  private screen: THREE.Mesh;
  private keyboardCanvas: HTMLCanvasElement;
  private screenCanvas: HTMLCanvasElement;
  private keyboardTexture: THREE.CanvasTexture;
  private screenTexture: THREE.CanvasTexture;
  private scene: THREE.Scene;

  private scrollOffset = 0;
  private typingTimer = 0;
  private activeKey = { row: 1, col: 4 };
  private _activeHand: 'left' | 'right' = 'left';
  private codeLines: ReturnType<typeof buildCodeLines>;
  private _visible = false;
  private nextKeyTime = 0.08;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.codeLines = buildCodeLines();

    // 全息键盘
    this.keyboardCanvas = document.createElement('canvas');
    this.keyboardCanvas.width = 512;
    this.keyboardCanvas.height = 200;
    this.keyboardTexture = new THREE.CanvasTexture(this.keyboardCanvas);
    this.keyboardTexture.minFilter = THREE.LinearFilter;

    const kbMat = new THREE.MeshBasicMaterial({
      map: this.keyboardTexture,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthTest: false,
    });
    this.keyboard = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.23), kbMat);
    this.keyboard.position.set(0, 0.84, 0.38);
    this.keyboard.rotation.x = -0.42;
    this.keyboard.renderOrder = 3000;
    this.keyboard.visible = false;
    scene.add(this.keyboard);

    // 全息代码屏
    this.screenCanvas = document.createElement('canvas');
    this.screenCanvas.width = 800;
    this.screenCanvas.height = 500;
    this.screenTexture = new THREE.CanvasTexture(this.screenCanvas);
    this.screenTexture.minFilter = THREE.LinearFilter;

    const scrMat = new THREE.MeshBasicMaterial({
      map: this.screenTexture,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthTest: false,
    });
    this.screen = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.5), scrMat);
    this.screen.position.set(0, 1.42, 0.43);
    this.screen.rotation.x = -0.1;
    this.screen.renderOrder = 3001;
    this.screen.visible = false;
    scene.add(this.screen);
  }

  setVisible(v: boolean): void {
    this._visible = v;
    this.keyboard.visible = v;
    this.screen.visible = v;
    if (v) {
      this.scrollOffset = 0;
      this.typingTimer = 0;
    }
  }

  get visible(): boolean {
    return this._visible;
  }

  getActiveHand(): 'left' | 'right' {
    return this._activeHand;
  }

  update(delta: number): void {
    if (!this._visible) return;

    // 打字节奏
    this.typingTimer += delta;
    if (this.typingTimer >= this.nextKeyTime) {
      this.typingTimer = 0;
      this.nextKeyTime = 0.06 + Math.random() * 0.12;
      // 随机按键
      const row = Math.floor(Math.random() * KEYBOARD_ROWS.length);
      const rowText = KEYBOARD_ROWS[row] ?? KEYBOARD_ROWS[0]!;
      this.activeKey = {
        row,
        col: Math.floor(Math.random() * rowText.length),
      };
      this._activeHand = this.activeKey.col < 6 ? 'left' : 'right';
    }

    // 代码滚动
    this.scrollOffset += delta * 30;

    // 更新纹理（每 2 帧更新一次以节省性能）
    this.renderKeyboard();
    this.renderScreen();
  }

  private renderKeyboard(): void {
    const ctx = this.keyboardCanvas.getContext('2d')!;
    const w = this.keyboardCanvas.width;
    const h = this.keyboardCanvas.height;

    ctx.clearRect(0, 0, w, h);

    const keyW = 34;
    const keyH = 36;
    const gap = 4;
    const startX = 30;
    const startY = 15;

    for (let r = 0; r < KEYBOARD_ROWS.length; r++) {
      const row = KEYBOARD_ROWS[r];
      if (!row) continue;
      const offsetX = r * 12;
      for (let c = 0; c < row.length; c++) {
        const x = startX + offsetX + c * (keyW + gap);
        const y = startY + r * (keyH + gap);
        const isActive = r === this.activeKey.row && c === this.activeKey.col;

        // 按键背景
        ctx.fillStyle = isActive ? 'rgba(80, 250, 255, 0.5)' : 'rgba(30, 180, 220, 0.15)';
        ctx.strokeStyle = isActive ? 'rgba(80, 250, 255, 0.9)' : 'rgba(60, 180, 220, 0.4)';
        ctx.lineWidth = isActive ? 2 : 1;

        ctx.beginPath();
        ctx.roundRect(x, y, keyW, keyH, 4);
        ctx.fill();
        ctx.stroke();

        // 按键发光
        if (isActive) {
          ctx.shadowColor = '#50faff';
          ctx.shadowBlur = 15;
          ctx.fillStyle = 'rgba(80, 250, 255, 0.3)';
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        // 字母
        ctx.fillStyle = isActive ? '#ffffff' : 'rgba(120, 220, 240, 0.7)';
        ctx.font = '14px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(row[c] ?? '', x + keyW / 2, y + keyH / 2);
      }
    }

    this.keyboardTexture.needsUpdate = true;
  }

  private renderScreen(): void {
    const ctx = this.screenCanvas.getContext('2d')!;
    const w = this.screenCanvas.width;
    const h = this.screenCanvas.height;

    // 背景
    ctx.fillStyle = 'rgba(5, 10, 30, 0.92)';
    ctx.fillRect(0, 0, w, h);

    // 边框发光
    ctx.strokeStyle = 'rgba(50, 200, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#38c8ff';
    ctx.shadowBlur = 8;
    ctx.strokeRect(4, 4, w - 8, h - 8);
    ctx.shadowBlur = 0;

    // 顶部栏
    ctx.fillStyle = 'rgba(30, 60, 100, 0.6)';
    ctx.fillRect(4, 4, w - 8, 24);
    ctx.fillStyle = '#8be9fd';
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('  main.ts — AI Digital Human', 12, 20);

    // 代码内容
    const lineH = 18;
    const visibleLines = Math.floor((h - 40) / lineH);
    const totalLines = this.codeLines.length;
    const scrollLine = (this.scrollOffset / lineH) % totalLines;

    ctx.save();
    ctx.beginPath();
    ctx.rect(8, 32, w - 16, h - 40);
    ctx.clip();

    ctx.font = '13px "Fira Code", "Consolas", monospace';
    ctx.textAlign = 'left';

    for (let i = 0; i < visibleLines + 2; i++) {
      const lineIdx = Math.floor(scrollLine + i) % totalLines;
      const y = 48 + i * lineH - (scrollLine % 1) * lineH;
      const line = this.codeLines[lineIdx];
      if (!line) continue;

      // 行号
      ctx.fillStyle = 'rgba(100, 115, 150, 0.5)';
      ctx.fillText(String(lineIdx + 1).padStart(3), 12, y);

      // 语法高亮文本
      let x = 48;
      for (const segment of line.colors) {
        ctx.fillStyle = segment.color;
        const text = line.text.substring(segment.start, segment.end);
        ctx.fillText(text, x, y);
        x += ctx.measureText(text).width;
      }
      if (line.colors.length === 0) {
        ctx.fillStyle = '#f8f8f2';
        ctx.fillText(line.text, 48, y);
      }
    }

    ctx.restore();

    // 扫描线效果
    ctx.fillStyle = 'rgba(0, 0, 0, 0.04)';
    for (let y = 0; y < h; y += 3) {
      ctx.fillRect(0, y, w, 1);
    }

    // 光标闪烁
    const cursorLine = Math.floor(scrollLine + visibleLines - 2) % totalLines;
    const cursorY = 48 + (visibleLines - 2) * lineH - (scrollLine % 1) * lineH;
    const cursorX = 48 + (this.codeLines[cursorLine]?.text.length || 0) * 7.8;
    if (Math.floor(this.scrollOffset / 15) % 2 === 0) {
      ctx.fillStyle = '#50fa7b';
      ctx.shadowColor = '#50fa7b';
      ctx.shadowBlur = 6;
      ctx.fillRect(cursorX, cursorY - 12, 8, 15);
      ctx.shadowBlur = 0;
    }

    this.screenTexture.needsUpdate = true;
  }

  dispose(): void {
    this.scene.remove(this.keyboard);
    this.scene.remove(this.screen);
    this.keyboard.geometry.dispose();
    this.screen.geometry.dispose();
    (this.keyboard.material as THREE.Material).dispose();
    (this.screen.material as THREE.Material).dispose();
    this.keyboardTexture.dispose();
    this.screenTexture.dispose();
  }
}
