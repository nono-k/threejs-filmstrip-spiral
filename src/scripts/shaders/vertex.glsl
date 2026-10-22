varying vec2 vUv;
varying float vWorldY;
flat varying float vImage;
flat varying vec2 vPhotoMin;
flat varying vec2 vPhotoMax;

attribute float aImage;
attribute vec2 aPhotoMin;
attribute vec2 aPhotoMax;

void main() {
  vUv = uv;
  vImage = aImage;
  vPhotoMin = aPhotoMin;
  vPhotoMax = aPhotoMax;

  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldY = worldPosition.y;

  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}