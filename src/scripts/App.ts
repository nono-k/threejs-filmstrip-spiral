import * as THREE from 'three';
import { OrthographicCamera } from './core/Camera';
import { Three } from './core/Three';
import { FilmSpiral } from './FilmSpiral';
import { Gui } from './Gui';

const PARAMS = {
  radius: 1.2, // 螺旋の半径
  waveLength: 1.7, // 1周で上がる高さ
  filmWidth: 0.5, // フィルムの幅
}

const BASE_URL = '/threejs-filmstrip-spiral';

export const Images = [
  `${BASE_URL}/images/image-01.webp`,
  `${BASE_URL}/images/image-02.webp`,
  `${BASE_URL}/images/image-03.webp`,
  `${BASE_URL}/images/image-04.webp`,
  `${BASE_URL}/images/image-05.webp`,
  `${BASE_URL}/images/image-06.webp`,
  `${BASE_URL}/images/image-07.webp`,
  `${BASE_URL}/images/image-08.webp`,
  `${BASE_URL}/images/image-09.webp`,
  `${BASE_URL}/images/image-10.webp`,
];

export class App extends Three {
  private readonly camera: OrthographicCamera;
  private textures: THREE.Texture[] = [];
  private filmSpiral?: FilmSpiral;
  private targetRotation = 1.2;

  constructor(canvas: HTMLCanvasElement) {
    super(canvas);

    this.camera = new OrthographicCamera();
    this.camera.position.set(0, 0, 1.5);

    this.scene.background = new THREE.Color('#D9DAD4');

    this.init();
  }

  private async init() {
    this.textures = await this.loadTextures(Images);
    this.buildFilmSpiral();
    this.setGui();

    window.addEventListener('wheel', this.onWheel);
    window.addEventListener('resize', this.resize);
    this.renderer.setAnimationLoop(this.animate);
  }

  private async loadTextures(urls: string[]) {
    const loader = new THREE.TextureLoader();
    const textures = await Promise.all(urls.map(async url => {
      const texture = await loader.loadAsync(url);
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    }));

    return textures;
  }

  private buildFilmSpiral() {
    if (this.filmSpiral) {
      this.scene.remove(this.filmSpiral.group);
      this.filmSpiral.dispose();
    }

    this.filmSpiral = new FilmSpiral(this.textures, PARAMS, this.targetRotation);
    this.scene.add(this.filmSpiral.group);
  }

  private setGui() {
    const pane = new Gui();
    pane.addBinding(PARAMS, 'radius', { min: 0.4, max: 1.4, step: 0.1 });
    pane.addBinding(PARAMS, 'waveLength', { min: 0.6, max: 2, step: 0.1 });
    pane.addBinding(PARAMS, 'filmWidth', { min: 0.3, max: 0.5, step: 0.1 });

    pane.on('change', () => {
      this.buildFilmSpiral();
    });
  }

  private onWheel = (event: WheelEvent) => {
    this.targetRotation -= event.deltaY / 400;
  }

  private animate = () => {
    this.filmSpiral?.update(this.targetRotation, performance.now());

    this.renderer.render(this.scene, this.camera);
  }

  private resize() {
    this.camera.update();
  }
}

const app = new App(document.getElementById('webgl') as HTMLCanvasElement);

window.addEventListener('beforeunload', () => {
  app.dispose();
});
