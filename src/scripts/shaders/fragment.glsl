precision mediump float;

varying vec2 vUv;
varying float vWorldY;
flat varying float vImage;
flat varying vec2 vPhotoMin;
flat varying vec2 vPhotoMax;

uniform sampler2DArray uFilms;

out vec4 fragColor;

vec3 filmGrade(vec3 color) {
  float luma = dot(color, vec3(0.299, 0.587, 0.114));

  color = pow(max(color, 0.0), vec3(0.92));
  color = color * 0.9 + 0.045;
  color = mix(vec3(luma), color, 0.72);

  luma = dot(color, vec3(0.299, 0.587, 0.114));
  vec3 shadow = vec3(0.22, 0.12, 0.07);
  vec3 highlight = vec3(1.0, 0.95, 0.86);
  color = mix(color, mix(shadow, highlight, smoothstep(0.05, 0.85, luma)), 0.22);

  return clamp(color, 0.0, 1.0);
}

void main() {
  float amount = smoothstep(0.75, 1.0, abs(vWorldY)) * 0.75;

  vec4 tex = texture(uFilms, vec3(vUv, vImage));
  if (tex.a < 0.5) discard;

  vec2 photoUv = (vUv - vPhotoMin) / (vPhotoMax - vPhotoMin);
  float inPhoto = step(0.0, photoUv.x) * step(photoUv.x, 1.0)
    * step(0.0, photoUv.y) * step(photoUv.y, 1.0);

  vec3 color = mix(tex.rgb, filmGrade(tex.rgb), inPhoto);
  color = mix(color, vec3(0.851, 0.855, 0.831), amount);
  fragColor = vec4(color, 1.0);
}