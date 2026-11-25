export const VERTEX_SHADER_SOURCE = `#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_texCoord;

out vec2 v_texCoord;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
`;

export const FRAGMENT_SHADER_SOURCE = `#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 outColor;

uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_time;

uniform float u_exposure;
uniform float u_contrast;
uniform float u_saturation;
uniform float u_temperature;
uniform float u_tint;
uniform float u_highlights;
uniform float u_shadows;
uniform float u_vignette;
uniform float u_sharpen;
uniform int u_lutId;

uniform int u_chromaEnabled;
uniform vec3 u_chromaColor;
uniform float u_chromaSimilarity;
uniform float u_chromaSmoothness;
uniform float u_chromaSpill;

uniform float u_blur;
uniform float u_chromaticAberration;
uniform float u_vhsGlitch;
uniform float u_filmGrain;

uniform float u_opacity;
uniform float u_dipBlack;

float rand(vec2 co) {
  return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

vec3 rgbToYCbCr(vec3 c) {
  float y  =  0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
  float cb = -0.168736 * c.r - 0.331264 * c.g + 0.5 * c.b;
  float cr =  0.5 * c.r - 0.418688 * c.g - 0.081312 * c.b;
  return vec3(y, cb, cr);
}

vec3 applyCinemaLut(vec3 col, int lutId) {
  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  if (lutId == 1) {
    vec3 shadowsTint = vec3(0.02, 0.11, 0.14);
    vec3 highsTint = vec3(0.14, 0.06, -0.04);
    col += mix(shadowsTint, highsTint, smoothstep(0.15, 0.85, luma));
    col = pow(max(col, 0.0), vec3(0.96, 1.0, 1.04));
  } else if (lutId == 2) {
    col = col * 0.94 + vec3(0.02, 0.015, 0.008);
    col = mix(vec3(luma), col, 1.12);
    col.r = smoothstep(-0.04, 1.02, col.r);
    col.g = smoothstep(-0.02, 1.01, col.g);
    col.b = smoothstep(0.02, 0.98, col.b);
  } else if (lutId == 3) {
    float bw = dot(col, vec3(0.32, 0.56, 0.12));
    bw = smoothstep(0.08, 0.92, bw);
    col = vec3(bw * 0.98, bw * 0.99, bw * 1.03);
  } else if (lutId == 4) {
    vec3 shadow = vec3(0.02, 0.14, 0.22);
    vec3 mid = vec3(0.05, 0.02, 0.12);
    vec3 hi = vec3(0.22, 0.08, 0.02);
    col += mix(shadow, hi, smoothstep(0.2, 0.85, luma)) + mid * (1.0 - abs(luma - 0.5) * 2.0);
    col = mix(vec3(luma), col, 1.32);
  } else if (lutId == 5) {
    col = vec3(
      col.r * 1.08 + 0.03,
      col.g * 1.01 + 0.015,
      col.b * 0.84 + 0.02
    );
    col = mix(vec3(luma), col, 0.85);
  }
  return clamp(col, 0.0, 1.0);
}

vec4 sampleWithFx(vec2 uv) {
  vec2 texel = 1.0 / max(u_resolution, vec2(1.0));
  vec2 sampleUv = uv;

  if (u_vhsGlitch > 0.001) {
    float line = floor(uv.y * 90.0);
    float tear = (rand(vec2(line, floor(u_time * 18.0))) - 0.5) * 2.0;
    float trigger = step(0.84 - u_vhsGlitch * 0.35, rand(vec2(line * 0.3, floor(u_time * 12.0))));
    sampleUv.x += tear * trigger * u_vhsGlitch * 0.06;
  }

  float ca = (u_chromaticAberration * 0.014) + (u_vhsGlitch * 0.008);
  vec4 base;
  if (ca > 0.0001) {
    vec2 dir = (sampleUv - 0.5) * ca;
    float r = texture(u_texture, clamp(sampleUv + dir, 0.0, 1.0)).r;
    vec4 gSample = texture(u_texture, clamp(sampleUv, 0.0, 1.0));
    float b = texture(u_texture, clamp(sampleUv - dir, 0.0, 1.0)).b;
    base = vec4(r, gSample.g, b, gSample.a);
  } else {
    base = texture(u_texture, clamp(sampleUv, 0.0, 1.0));
  }

  if (u_blur > 0.001) {
    float radius = u_blur * 6.0;
    vec4 sum = base * 0.24;
    sum += texture(u_texture, clamp(sampleUv + texel * vec2( radius,  0.0), 0.0, 1.0)) * 0.12;
    sum += texture(u_texture, clamp(sampleUv + texel * vec2(-radius,  0.0), 0.0, 1.0)) * 0.12;
    sum += texture(u_texture, clamp(sampleUv + texel * vec2( 0.0,  radius), 0.0, 1.0)) * 0.12;
    sum += texture(u_texture, clamp(sampleUv + texel * vec2( 0.0, -radius), 0.0, 1.0)) * 0.12;
    sum += texture(u_texture, clamp(sampleUv + texel * vec2( radius,  radius), 0.0, 1.0)) * 0.07;
    sum += texture(u_texture, clamp(sampleUv + texel * vec2(-radius,  radius), 0.0, 1.0)) * 0.07;
    sum += texture(u_texture, clamp(sampleUv + texel * vec2( radius, -radius), 0.0, 1.0)) * 0.07;
    sum += texture(u_texture, clamp(sampleUv + texel * vec2(-radius, -radius), 0.0, 1.0)) * 0.07;
    base = sum;
  }

  if (u_sharpen > 0.001) {
    vec3 neighbors =
      texture(u_texture, clamp(sampleUv + texel * vec2(1.0, 0.0), 0.0, 1.0)).rgb +
      texture(u_texture, clamp(sampleUv + texel * vec2(-1.0, 0.0), 0.0, 1.0)).rgb +
      texture(u_texture, clamp(sampleUv + texel * vec2(0.0, 1.0), 0.0, 1.0)).rgb +
      texture(u_texture, clamp(sampleUv + texel * vec2(0.0, -1.0), 0.0, 1.0)).rgb;
    vec3 detail = base.rgb - (neighbors * 0.25);
    base.rgb = clamp(base.rgb + detail * (u_sharpen * 2.2), 0.0, 1.0);
  }

  return base;
}

void main() {
  vec4 tex = sampleWithFx(v_texCoord);
  vec3 col = tex.rgb;
  float alpha = tex.a;

  if (u_chromaEnabled == 1) {
    vec3 keyYcc = rgbToYCbCr(u_chromaColor);
    vec3 pxYcc = rgbToYCbCr(col);
    float chromaDist = distance(pxYcc.yz, keyYcc.yz);
    float mask = smoothstep(u_chromaSimilarity, u_chromaSimilarity + max(0.005, u_chromaSmoothness), chromaDist);
    alpha *= mask;

    if (u_chromaSpill > 0.001) {
      float spillAmt = 1.0 - smoothstep(u_chromaSimilarity, u_chromaSimilarity + u_chromaSmoothness * 2.5 + 0.15, chromaDist);
      float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(col, vec3(luma), spillAmt * u_chromaSpill);
    }
  }

  col *= pow(2.0, u_exposure);
  col.r += u_temperature * 0.0022;
  col.b -= u_temperature * 0.0022;
  col.g += u_tint * 0.0018;

  float luma = dot(clamp(col, 0.0, 1.0), vec3(0.2126, 0.7152, 0.0722));
  float shadowWeight = 1.0 - smoothstep(0.0, 0.55, luma);
  float highlightWeight = smoothstep(0.45, 1.0, luma);
  col += shadowWeight * (u_shadows * 0.0035);
  col += highlightWeight * (u_highlights * 0.0035);

  col = (col - 0.5) * u_contrast + 0.5;

  float satLuma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(satLuma), col, u_saturation);

  col = applyCinemaLut(clamp(col, 0.0, 1.0), u_lutId);

  if (u_filmGrain > 0.001) {
    float n = (rand(v_texCoord * u_resolution + vec2(u_time * 37.0, u_time * 13.0)) - 0.5) * u_filmGrain * 0.24;
    col = clamp(col + n, 0.0, 1.0);
  }

  if (u_vhsGlitch > 0.001) {
    float scan = sin(v_texCoord.y * u_resolution.y * 1.5) * 0.06 * u_vhsGlitch;
    col = clamp(col - scan, 0.0, 1.0);
  }

  if (u_vignette > 0.001) {
    float dist = distance(v_texCoord, vec2(0.5));
    float vig = smoothstep(0.95 - u_vignette * 0.45, 0.22, dist);
    col *= mix(1.0, vig, u_vignette);
  }

  col *= (1.0 - clamp(u_dipBlack, 0.0, 1.0));
  outColor = vec4(col, alpha * u_opacity);
}
`;
