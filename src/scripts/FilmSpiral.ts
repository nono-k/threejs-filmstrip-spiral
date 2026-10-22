import * as THREE from 'three';
import fragment from './shaders/fragment.glsl?raw';
import vertex from './shaders/vertex.glsl?raw';

export type FilmSpiralOptions = {
  radius: number; // 螺旋の半径
  waveLength: number; // 1周で上がる高さ
  filmWidth: number; // フィルムの幅
}

type BakedFilm = {
  canvas: HTMLCanvasElement;
  photoMin: THREE.Vector2;
  photoMax: THREE.Vector2;
}

const FILM_COLOR = '#000000';
const PRECISION = 25; // 1コマを何分割するか

export class FilmSpiral {
  readonly group = new THREE.Group();
  private readonly radius: number;
  private readonly waveLength: number;
  private readonly filmWidth: number;
  private readonly slideCount: number;
  private readonly turns: number;
  private geometry?: THREE.BufferGeometry;
  private material?: THREE.ShaderMaterial;
  private filmTexture?: THREE.DataArrayTexture;
  private rotation = 0;

  constructor(sources: THREE.Texture[], options: FilmSpiralOptions, initialRotation = 1.2) {
    this.radius = options.radius;
    this.waveLength = options.waveLength;
    this.filmWidth = options.filmWidth;
    this.rotation = initialRotation;
    this.slideCount = sources.length;

    const cameraHalf = 1;
    const neededHeight = cameraHalf * 2 + this.waveLength * 3;
    this.turns = Math.ceil(neededHeight / this.waveLength);

    this.build(sources);
    this.apply();
  }

  update(targetRotation: number, timeMs: number) {
    this.rotation += (targetRotation - this.rotation) / 20;
    const wobble = Math.sin(timeMs / 2000) / 500;
    this.apply(wobble);
  }

  private apply(wobble = 0) {
    const tau = Math.PI * 2;
    const rotation = this.rotation + wobble;
    const wrappedTurns = rotation / tau - Math.floor(rotation / tau);
    const mid = (this.turns / 2) * this.waveLength - this.filmWidth;

    this.group.rotation.y = wrappedTurns * tau;
    this.group.position.y = -mid + wrappedTurns * this.waveLength;
  }

  private build(sources: THREE.Texture[]) {
    const films = sources.map(source => this.drawFilm(source.image as HTMLImageElement));
    const texture = this.createFilmArray(films);
    const geometry = this.createGeometry(films);

    const material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: {
        uFilms: { value: texture },
      },
      side: THREE.DoubleSide,
    });

    this.geometry = geometry;
    this.material = material;
    this.filmTexture = texture;
    this.group.add(new THREE.Mesh(geometry, material));
  }

  private createFilmArray(films: BakedFilm[]) {
    const width = films[0]?.canvas.width ?? 0;
    const height = films[0]?.canvas.height ?? 0;
    const data = new Uint8Array(width * height * 4 * films.length);

    films.forEach((film, layer) => {
      const context = film.canvas.getContext('2d');
      if (!context) return;
      const pixels = context.getImageData(0, 0, width, height).data;
      this.copyFlipped(pixels, data, layer, width, height);
    });

    const texture = new THREE.DataArrayTexture(data, width, height, films.length);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    texture.flipY = false;
    texture.needsUpdate = true;
    return texture;
  }

  private copyFlipped(pixels: Uint8ClampedArray, target: Uint8Array, layer: number, width: number, height: number) {
    const stride = width * 4;
    const offset = layer * stride * height;

    for (let y = 0; y < height; y++) {
      const src = y * stride;
      const dst = offset + (height - 1 - y) * stride;
      target.set(pixels.subarray(src, src + stride), dst);
    }
  }

  private createGeometry(films: BakedFilm[]) {
    const slideTotal = this.slideCount * this.turns;
    const vertexCount = slideTotal * PRECISION * 6;
    const positions = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);
    const images = new Float32Array(vertexCount);
    const photoMin = new Float32Array(vertexCount * 2);
    const photoMax = new Float32Array(vertexCount * 2);

    let vertex = 0;
    for (let slide = 0; slide < slideTotal; slide++) {
      const imageIndex = slide % this.slideCount;
      const film = films[imageIndex];
      if (!film) continue;
      vertex = this.writeSlide(slide, imageIndex, film, positions, uvs, images, photoMin, photoMax, vertex);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setAttribute('aImage', new THREE.BufferAttribute(images, 1));
    geometry.setAttribute('aPhotoMin', new THREE.BufferAttribute(photoMin, 2));
    geometry.setAttribute('aPhotoMax', new THREE.BufferAttribute(photoMax, 2));
    return geometry;
  }

  private writeSlide(
    slideIndex: number,
    imageIndex: number,
    film: BakedFilm,
    positions: Float32Array,
    uvs: Float32Array,
    images: Float32Array,
    photoMin: Float32Array,
    photoMax: Float32Array,
    vertex: number,
  ) {
    const tau = Math.PI * 2;
    const denom = this.slideCount * PRECISION;

    for (let segment = 0; segment < PRECISION; segment++) {
      const index = slideIndex * PRECISION + segment;
      const i1 = index / denom;
      const i2 = (index + 1) / denom;
      const a1 = i1 * tau;
      const a2 = i2 * tau;
      const dy1 = i1 * this.waveLength - this.filmWidth;
      const dy2 = i2 * this.waveLength - this.filmWidth;
      const x1 = Math.cos(a1) * this.radius;
      const z1 = Math.sin(a1) * this.radius;
      const x2 = Math.cos(a2) * this.radius;
      const z2 = Math.sin(a2) * this.radius;
      const u1 = segment / PRECISION;
      const u2 = (segment + 1) / PRECISION;

      const corners = [
        x1, this.filmWidth + dy1, z1, u1, 1,
        x1, -this.filmWidth + dy1, z1, u1, 0,
        x2, -this.filmWidth + dy2, z2, u2, 0,
        x2, this.filmWidth + dy2, z2, u2, 1,
        x2, -this.filmWidth + dy2, z2, u2, 0,
        x1, this.filmWidth + dy1, z1, u1, 1,
      ];

      for (let corner = 0; corner < 6; corner++) {
        const source = corner * 5;
        const position = vertex * 3;
        const uv = vertex * 2;
        positions[position] = corners[source] ?? 0;
        positions[position + 1] = corners[source + 1] ?? 0;
        positions[position + 2] = corners[source + 2] ?? 0;
        uvs[uv] = corners[source + 3] ?? 0;
        uvs[uv + 1] = corners[source + 4] ?? 0;
        images[vertex] = imageIndex;
        photoMin[uv] = film.photoMin.x;
        photoMin[uv + 1] = film.photoMin.y;
        photoMax[uv] = film.photoMax.x;
        photoMax[uv + 1] = film.photoMax.y;
        vertex++;
      }
    }

    return vertex;
  }

  private drawFilm(image: HTMLImageElement): BakedFilm {
    const photoSize = 512;
    const pad = Math.round(photoSize * 0.05);
    const width = photoSize + pad * 2;
    const hole = width / 10 / 2;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = photoSize + pad * 4 + hole * 2;
    const context = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;

    context.fillStyle = FILM_COLOR;
    context.fillRect(0, 0, canvas.width, canvas.height);

    const scale = Math.max(photoSize / image.width, photoSize / image.height);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    const dx = pad + (photoSize - drawWidth) / 2;
    const dy = pad * 2 + hole + (photoSize - drawHeight) / 2;

    context.drawImage(image, dx, dy, drawWidth, drawHeight);

    for (let i = 0; i < 10; i++) {
      const x = i * 2 * hole + hole / 2;
      context.clearRect(x, pad, hole, hole);
      context.clearRect(x, canvas.height - pad - hole, hole, hole);
    }

    const x0 = Math.max(0, dx);
    const y0 = Math.max(0, dy);
    const x1 = Math.min(canvas.width, dx + drawWidth);
    const y1 = Math.min(canvas.height, dy + drawHeight);

    return {
      canvas,
      photoMin: new THREE.Vector2(x0 / canvas.width, 1 - y1 / canvas.height),
      photoMax: new THREE.Vector2(x1 / canvas.width, 1 - y0 / canvas.height),
    };
  }

  dispose() {
    this.geometry?.dispose();
    this.material?.dispose();
    this.filmTexture?.dispose();
    this.group.clear();
  }
}