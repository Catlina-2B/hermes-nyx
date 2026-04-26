import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRM } from '@pixiv/three-vrm';

export class VRMRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private vrm: VRM | null = null;
  private rafId = 0;
  private onFrameCallbacks: Array<(delta: number) => void> = [];

  constructor(canvas: HTMLCanvasElement) {
    // 渲染器
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // 场景
    this.scene = new THREE.Scene();
    this.scene.background = null;

    // 相机：全身视角
    this.camera = new THREE.PerspectiveCamera(25, 1, 0.5, 10);
    this.camera.position.set(0, 0.7, 4.5);
    this.camera.lookAt(0, 0.7, 0);

    // 灯光
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
    mainLight.position.set(1, 1, 1).normalize();
    this.scene.add(mainLight);
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-1, -0.5, 0.5).normalize();
    this.scene.add(fillLight);
  }

  async loadModel(url: string): Promise<VRM> {
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    const gltf = await loader.loadAsync(url);
    const vrm: VRM = gltf.userData.vrm;

    // This project's VRoid models already face the camera from Z+.
    // Keep root rotation neutral so authored VRM pose directions stay stable.

    // 移除旧模型
    if (this.vrm) {
      this.scene.remove(this.vrm.scene);
    }

    this.scene.add(vrm.scene);
    this.vrm = vrm;
    return vrm;
  }

  getVRM(): VRM | null {
    return this.vrm;
  }

  getScene(): THREE.Scene {
    return this.scene;
  }

  /** 注册每帧回调 */
  onFrame(cb: (delta: number) => void): void {
    this.onFrameCallbacks.push(cb);
  }

  /** 调整画布尺寸 */
  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  /** 启动渲染循环 */
  start(): void {
    const animate = () => {
      this.rafId = requestAnimationFrame(animate);
      const delta = this.clock.getDelta();

      // 执行所有帧回调
      for (const cb of this.onFrameCallbacks) {
        cb(delta);
      }

      // 更新 VRM 系统（表情、骨骼、弹簧骨物理等）
      if (this.vrm) {
        this.vrm.update(delta);
      }

      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  /** 停止渲染循环 */
  stop(): void {
    cancelAnimationFrame(this.rafId);
  }

  dispose(): void {
    this.stop();
    if (this.vrm) {
      this.scene.remove(this.vrm.scene);
    }
    this.renderer.dispose();
    this.onFrameCallbacks = [];
  }
}
