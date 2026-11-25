import {
  CINEMA_LUT_PRESETS,
  ChromaKeyParams,
  ColorGradeParams,
  GpuFxParams,
} from '../../types/effects';
import { FRAGMENT_SHADER_SOURCE, VERTEX_SHADER_SOURCE } from './shaderSources';

export interface GpuLayerPassParams {
  source: HTMLCanvasElement;
  width: number;
  height: number;
  time: number;
  opacity: number;
  dipBlack: number;
  colorGrade: ColorGradeParams;
  chromaKey: ChromaKeyParams;
  gpuFx: GpuFxParams;
}

function hexToRgbNormalized(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return [0, 1, 0];
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return [
    Number.isFinite(r) ? r : 0,
    Number.isFinite(g) ? g : 1,
    Number.isFinite(b) ? b : 0,
  ];
}

export class WebGLCompositor {
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private texture: WebGLTexture | null = null;
  private uniforms = new Map<string, WebGLUniformLocation | null>();
  private contextLost = false;
  public backend: 'WebGL2' | 'Canvas2D';

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.addEventListener('webglcontextlost', this.handleContextLost, false);

    const gl = this.canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
      powerPreference: 'low-power',
    });

    if (gl && this.initPipeline(gl)) {
      this.gl = gl;
      this.backend = 'WebGL2';
    } else {
      this.backend = 'Canvas2D';
    }
  }

  private handleContextLost = (e: Event): void => {
    e.preventDefault();
    this.contextLost = true;
    this.gl = null;
    this.backend = 'Canvas2D';
  };

  private compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  private initPipeline(gl: WebGL2RenderingContext): boolean {
    const vs = this.compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
    const fs = this.compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
    if (!vs || !fs) return false;

    const program = gl.createProgram();
    if (!program) return false;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return false;
    }

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    const vertices = new Float32Array([
      -1, -1, 0, 1,
       1, -1, 1, 1,
      -1,  1, 0, 0,
       1,  1, 1, 0,
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(program, 'a_position');
    const uvLoc = gl.getAttribLocation(program, 'a_texCoord');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(uvLoc);
    gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 16, 8);

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    this.program = program;
    this.vao = vao;
    this.texture = texture;

    const names = [
      'u_texture', 'u_resolution', 'u_time',
      'u_exposure', 'u_contrast', 'u_saturation', 'u_temperature', 'u_tint',
      'u_highlights', 'u_shadows', 'u_vignette', 'u_sharpen', 'u_lutId',
      'u_chromaEnabled', 'u_chromaColor', 'u_chromaSimilarity', 'u_chromaSmoothness', 'u_chromaSpill',
      'u_blur', 'u_chromaticAberration', 'u_vhsGlitch', 'u_filmGrain',
      'u_opacity', 'u_dipBlack',
    ];
    names.forEach((n) => this.uniforms.set(n, gl.getUniformLocation(program, n)));
    return true;
  }

  public processLayer(params: GpuLayerPassParams): HTMLCanvasElement {
    const { source, width, height, colorGrade, chromaKey, gpuFx, time, opacity, dipBlack } = params;

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }

    if (this.contextLost || !this.gl || !this.program || !this.vao || !this.texture) {
      const ctx2d = this.canvas.getContext('2d');
      if (ctx2d) {
        ctx2d.clearRect(0, 0, width, height);
        const brightness = Math.pow(2, colorGrade.exposure) * (1 - dipBlack);
        ctx2d.filter = `brightness(${brightness}) contrast(${colorGrade.contrast}) saturate(${colorGrade.saturation}) blur(${gpuFx.blur * 6}px)`;
        ctx2d.globalAlpha = opacity;
        ctx2d.drawImage(source, 0, 0, width, height);
        ctx2d.filter = 'none';
        ctx2d.globalAlpha = 1;
      }
      return this.canvas;
    }

    const gl = this.gl;
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);

    const lutIndex =
      CINEMA_LUT_PRESETS.find((l) => l.id === colorGrade.lutId)?.shaderIndex ?? 0;
    const [kr, kg, kb] = hexToRgbNormalized(chromaKey.keyColor);

    gl.uniform1i(this.uniforms.get('u_texture') ?? null, 0);
    gl.uniform2f(this.uniforms.get('u_resolution') ?? null, width, height);
    gl.uniform1f(this.uniforms.get('u_time') ?? null, time);

    gl.uniform1f(this.uniforms.get('u_exposure') ?? null, colorGrade.exposure);
    gl.uniform1f(this.uniforms.get('u_contrast') ?? null, colorGrade.contrast);
    gl.uniform1f(this.uniforms.get('u_saturation') ?? null, colorGrade.saturation);
    gl.uniform1f(this.uniforms.get('u_temperature') ?? null, colorGrade.temperature);
    gl.uniform1f(this.uniforms.get('u_tint') ?? null, colorGrade.tint);
    gl.uniform1f(this.uniforms.get('u_highlights') ?? null, colorGrade.highlights);
    gl.uniform1f(this.uniforms.get('u_shadows') ?? null, colorGrade.shadows);
    gl.uniform1f(this.uniforms.get('u_vignette') ?? null, colorGrade.vignette);
    gl.uniform1f(this.uniforms.get('u_sharpen') ?? null, colorGrade.sharpen);
    gl.uniform1i(this.uniforms.get('u_lutId') ?? null, lutIndex);

    gl.uniform1i(this.uniforms.get('u_chromaEnabled') ?? null, chromaKey.enabled ? 1 : 0);
    gl.uniform3f(this.uniforms.get('u_chromaColor') ?? null, kr, kg, kb);
    gl.uniform1f(this.uniforms.get('u_chromaSimilarity') ?? null, chromaKey.similarity);
    gl.uniform1f(this.uniforms.get('u_chromaSmoothness') ?? null, chromaKey.smoothness);
    gl.uniform1f(this.uniforms.get('u_chromaSpill') ?? null, chromaKey.spill);

    gl.uniform1f(this.uniforms.get('u_blur') ?? null, gpuFx.blur);
    gl.uniform1f(this.uniforms.get('u_chromaticAberration') ?? null, gpuFx.chromaticAberration);
    gl.uniform1f(this.uniforms.get('u_vhsGlitch') ?? null, gpuFx.vhsGlitch);
    gl.uniform1f(this.uniforms.get('u_filmGrain') ?? null, gpuFx.filmGrain);

    gl.uniform1f(this.uniforms.get('u_opacity') ?? null, opacity);
    gl.uniform1f(this.uniforms.get('u_dipBlack') ?? null, dipBlack);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return this.canvas;
  }

  public dispose(): void {
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    if (!this.gl) return;
    if (this.texture) this.gl.deleteTexture(this.texture);
    if (this.vao) this.gl.deleteVertexArray(this.vao);
    if (this.program) this.gl.deleteProgram(this.program);
    this.gl = null;
  }
}
