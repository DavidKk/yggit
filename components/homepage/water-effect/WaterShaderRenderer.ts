/**
 * Yggit World Tree Stream Water Effect — WebGL Fragment Shader Renderer v2.2
 * Implements 《Yggit 世界树底部溪流动态效果技术方案 v1.0》 & 《Yggit 水流效果：问题与解决方案》:
 * - Strict Creek-Bed Masking: Water is strictly confined to the creek channel (y: 818..941, x: 525..895),
 *   never touching or bleeding onto the green grassy riverbanks or land!
 * - Default Flow Direction: Flows DOWNWARD toward the screen along the ~45° diagonal creek channel
 *   ("往下流，往屏幕方向，斜 45 度左右", from upper-right creek mouth (836, 818) to foreground (708, 941))
 * - Stream-Aligned Coordinate Projection (acrossCoord / alongCoord): Ripples naturally orient along
 *   the 45° diagonal stream channel and advance smoothly downstream in both Day & Night modes!
 */

export interface WaterShaderConfig {
  enabled: boolean
  flowOnlyMode: boolean // Step 1/2 Diagnostic Mode: turn off highlights to verify pure directional flow
  reverseFlow: boolean // false = downward ~45° toward screen (往下流/往屏幕方向, default), true = upward
  flowStrength: number
  flowSpeed: number
  normalStrength: number
  highlightStrength: number // Unified across Day & Night!
}

export const DEFAULT_WATER_CONFIG: WaterShaderConfig = {
  enabled: true,
  flowOnlyMode: false,
  reverseFlow: false,
  flowStrength: 0.011,
  flowSpeed: 0.34,
  normalStrength: 0.014,
  highlightStrength: 0.2,
}

// Stream active region in 1672x941 design coordinates (tightly bounds creek channel x: 525..895, y: 818..941)
export const STREAM_BOUNDS = {
  x: 505,
  y: 805,
  w: 410,
  h: 136,
  fullW: 1672,
  fullH: 941,
  supersample: 1.5, // 615x204 buffer: 4x fewer fragment pixels than 1170x422 while preserving crisp anti-aliased water
}

const VERTEX_SHADER_SRC = `
precision highp float;
attribute vec2 aPosition;
varying vec2 vRegionUv;
varying vec2 vFullUv;

uniform vec4 uRegionRect; // (x/fullW, y/fullH, w/fullW, h/fullH)

void main() {
  vRegionUv = vec2(aPosition.x, 1.0 - aPosition.y);
  vFullUv = vec2(
    uRegionRect.x + vRegionUv.x * uRegionRect.z,
    uRegionRect.y + vRegionUv.y * uRegionRect.w
  );
  gl_Position = vec4(aPosition * 2.0 - 1.0, 0.0, 1.0);
}
`

const FRAGMENT_SHADER_SRC = `
precision highp float;

varying vec2 vRegionUv;
varying vec2 vFullUv;

uniform vec4 uRegionRect;
uniform sampler2D uScene;
uniform sampler2D uWaterMask;
uniform sampler2D uDayBanks;
uniform sampler2D uNightBanks;
uniform sampler2D uFlowMap;
uniform sampler2D uNormalMap;

uniform float uTime;
uniform float uDayNightBlend; // 0.0 = Day, 1.0 = Night
uniform float uFlowStrength;
uniform float uFlowSpeed;
uniform float uNormalStrength;
uniform float uHighlightStrength;
uniform float uFlowOnlyMode;  // 1.0 = disable specular highlights, verify pure flow only
uniform float uFlowDirSign;   // +1.0 = downward ~45° toward screen (往下流/往屏幕方向, default), -1.0 = reverse

vec2 fullUvToRegionUv(vec2 fullUv) {
  return clamp((fullUv - uRegionRect.xy) / uRegionRect.zw, 0.001, 0.999);
}

float waterCoverage(vec2 uv) {
  float channel = texture2D(uWaterMask, uv).r;
  float banks = mix(texture2D(uDayBanks, uv).a, texture2D(uNightBanks, uv).a, uDayNightBlend);
  return channel * (1.0 - banks);
}

vec3 sampleWater(vec2 target) {
  vec2 uv = fullUvToRegionUv(target);
  float safe = smoothstep(0.15, 0.55, waterCoverage(uv));
  return texture2D(uScene, mix(vRegionUv, uv, safe)).rgb;
}

void main() {
  float rawMask = waterCoverage(vRegionUv);
  if (rawMask < 0.035) {
    gl_FragColor = vec4(0.0);
    return;
  }
  float mask = smoothstep(0.035, 0.66, rawMask);

  vec4 flowSample = texture2D(uFlowMap, vRegionUv);
  vec2 rawDir = flowSample.rg * 2.0 - 1.0;
  float dirLen = max(0.001, length(rawDir));
  vec2 flowDir = (rawDir / dirLen) * uFlowDirSign;
  vec2 perpDir = vec2(-flowDir.y, flowDir.x);
  float localSpeed = max(0.25, flowSample.b);
  float depth = smoothstep(0.11, 1.0, vRegionUv.y);
  float swell = mix(0.78, 1.46, depth);
  float cycleTime = uTime * uFlowSpeed;
  float phaseA = fract(cycleTime);
  float phaseB = fract(cycleTime + 0.5);
  float weightA = 0.5 - 0.5 * cos(phaseA * 6.2831853);
  float weightB = 1.0 - weightA;

  vec2 channelPoint = (vFullUv - vec2(0.48, 0.875)) * vec2(1.777, 1.0);
  float across = dot(channelPoint, vec2(0.79, 0.61));
  float downstream = dot(channelPoint, vec2(-0.61, 0.79));
  float travel = log(1.0 + 2.3 * downstream) / 2.3;
  float drift = cycleTime * uFlowDirSign;
  vec2 ribbonUv = vec2(across * 3.6, travel * 9.2 - drift * 0.62);
  vec2 rippleUv = vec2(across * 6.4 + 0.17, travel * 16.0 - drift * 1.17 + 0.31);
  vec2 ribbon = texture2D(uNormalMap, ribbonUv).rg * 2.0 - 1.0;
  vec2 ripple = texture2D(uNormalMap, rippleUv).rg * 2.0 - 1.0;
  vec2 localNormal = mix(ribbon, ripple, 0.29);
  vec2 smoothNormal = perpDir * localNormal.x + flowDir * localNormal.y;

  float bankSafe = smoothstep(0.10, 0.63, rawMask);
  float advectAmp = uFlowStrength * (0.78 + 0.44 * localSpeed) * bankSafe * swell;
  vec2 normalRefract = smoothNormal * uNormalStrength * 0.21 * bankSafe * swell;

  vec2 uvA = vFullUv - flowDir * (phaseA - 0.5) * advectAmp + normalRefract;
  vec2 uvB = vFullUv - flowDir * (phaseB - 0.5) * advectAmp + normalRefract;
  vec3 colA = sampleWater(uvA);
  vec3 colB = sampleWater(uvB);
  vec3 baseWater = colA * weightA + colB * weightB;

  // 5. Continuous Flowing Water-Ribbon Shading along the ~45° channel
  float ribbonWave = localNormal.y * 0.78 + localNormal.x * 0.32;
  float veinShade = clamp(ribbonWave * 0.155 * bankSafe * swell, -0.075, 0.10);
  vec3 waterTint = mix(vec3(0.76, 0.95, 1.0), vec3(0.28, 0.94, 0.88), uDayNightBlend);
  vec3 flowingWater = baseWater + waterTint * veinShade;

  // 6. Soft, Sparse Continuous Crest Highlights (Unified across Day & Night)
  vec3 finalWater = flowingWater;
  if (uFlowOnlyMode < 0.5 && uHighlightStrength > 0.001) {
    float crestAlign = max(0.0, localNormal.y * 0.85 - abs(localNormal.x) * 0.25);

    float softRibbonSheen = smoothstep(0.35, 0.82, crestAlign) * 0.24;
    float sparseCrestAccent = smoothstep(0.57, 0.90, crestAlign) * 0.28 * depth;

    float rawHighlight = (softRibbonSheen + sparseCrestAccent) * uHighlightStrength * bankSafe * swell;
    float safeHighlight = min(rawHighlight, 0.16);

    vec3 dayHighlightCol = vec3(0.88, 0.96, 1.00);
    vec3 nightHighlightCol = vec3(0.35, 0.96, 0.88);
    vec3 highlightCol = mix(dayHighlightCol, nightHighlightCol, uDayNightBlend);

    finalWater = clamp(flowingWater + highlightCol * safeHighlight, 0.0, 1.0);
  }

  gl_FragColor = vec4(finalWater, mask);
}
`

export class WaterShaderRenderer {
  private canvas: HTMLCanvasElement
  private sceneCrop: CanvasRenderingContext2D | null
  private gl: WebGLRenderingContext | null = null
  private program: WebGLProgram | null = null
  private textures: Record<string, WebGLTexture | null> = {}
  private uniforms: Record<string, WebGLUniformLocation | null> = {}
  private isReady = false
  private hasFailed = false

  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.width = Math.round(STREAM_BOUNDS.w * STREAM_BOUNDS.supersample)
    this.canvas.height = Math.round(STREAM_BOUNDS.h * STREAM_BOUNDS.supersample)
    const crop = document.createElement('canvas')
    crop.width = STREAM_BOUNDS.w
    crop.height = STREAM_BOUNDS.h
    this.sceneCrop = crop.getContext('2d')
    if (this.sceneCrop) this.sceneCrop.globalCompositeOperation = 'copy'
    this.initWebGL()
  }

  public dispose() {
    this.gl?.getExtension('WEBGL_lose_context')?.loseContext()
    this.isReady = false
    this.gl = null
  }

  private initWebGL() {
    try {
      const gl =
        (this.canvas.getContext('webgl', {
          alpha: true,
          premultipliedAlpha: false,
          antialias: false,
        }) as WebGLRenderingContext | null) ||
        (this.canvas.getContext('experimental-webgl', {
          alpha: true,
          premultipliedAlpha: false,
          antialias: false,
        }) as WebGLRenderingContext | null)

      if (!gl) {
        this.hasFailed = true
        return
      }
      this.gl = gl

      this.canvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault()
        this.isReady = false
      })

      const vs = this.compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SRC)
      const fs = this.compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SRC)
      if (!vs || !fs) {
        this.hasFailed = true
        return
      }

      const prog = gl.createProgram()
      if (!prog) {
        this.hasFailed = true
        return
      }
      gl.attachShader(prog, vs)
      gl.attachShader(prog, fs)
      gl.linkProgram(prog)

      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        this.hasFailed = true
        return
      }
      this.program = prog
      gl.useProgram(prog)

      const quadVerts = new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1])
      const buf = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, buf)
      gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW)

      const aPos = gl.getAttribLocation(prog, 'aPosition')
      gl.enableVertexAttribArray(aPos)
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

      const uNames = [
        'uRegionRect',
        'uScene',
        'uWaterMask',
        'uDayBanks',
        'uNightBanks',
        'uFlowMap',
        'uNormalMap',
        'uTime',
        'uDayNightBlend',
        'uFlowStrength',
        'uFlowSpeed',
        'uNormalStrength',
        'uHighlightStrength',
        'uFlowOnlyMode',
        'uFlowDirSign',
      ]
      for (const name of uNames) {
        this.uniforms[name] = gl.getUniformLocation(prog, name)
      }

      gl.uniform4f(
        this.uniforms.uRegionRect,
        STREAM_BOUNDS.x / STREAM_BOUNDS.fullW,
        STREAM_BOUNDS.y / STREAM_BOUNDS.fullH,
        STREAM_BOUNDS.w / STREAM_BOUNDS.fullW,
        STREAM_BOUNDS.h / STREAM_BOUNDS.fullH
      )
    } catch {
      this.hasFailed = true
    }
  }

  private compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
    const sh = gl.createShader(type)
    if (!sh) return null
    gl.shaderSource(sh, src)
    gl.compileShader(sh)
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      gl.deleteShader(sh)
      return null
    }
    return sh
  }

  private cropToStreamBounds(img: HTMLImageElement): HTMLCanvasElement {
    const c = document.createElement('canvas')
    c.width = STREAM_BOUNDS.w
    c.height = STREAM_BOUNDS.h
    const ctx = c.getContext('2d')
    if (ctx) {
      ctx.drawImage(img, STREAM_BOUNDS.x, STREAM_BOUNDS.y, STREAM_BOUNDS.w, STREAM_BOUNDS.h, 0, 0, STREAM_BOUNDS.w, STREAM_BOUNDS.h)
    }
    return c
  }

  public uploadTextures(
    waterMaskImg: HTMLImageElement,
    flowMapImg: HTMLImageElement,
    normalMapImg: HTMLImageElement,
    dayBanksImg: HTMLImageElement,
    nightBanksImg: HTMLImageElement
  ): boolean {
    if (this.hasFailed || !this.gl || !this.program || !this.sceneCrop) return false
    const gl = this.gl

    try {
      this.textures.scene = this.createTex(gl, this.sceneCrop.canvas, false, false)
      this.textures.waterMask = this.createTex(gl, this.cropToStreamBounds(waterMaskImg), false, false)
      this.textures.dayBanks = this.createTex(gl, this.cropToStreamBounds(dayBanksImg), false, false)
      this.textures.nightBanks = this.createTex(gl, this.cropToStreamBounds(nightBanksImg), false, false)
      this.textures.flowMap = this.createTex(gl, this.cropToStreamBounds(flowMapImg), false, false)
      this.textures.normalMap = this.createTex(gl, normalMapImg, true, true)
      this.isReady = Object.values(this.textures).every(Boolean)
      return this.isReady
    } catch {
      this.hasFailed = true
      this.isReady = false
      return false
    }
  }

  private isPowerOfTwo(n: number): boolean {
    return n > 0 && (n & (n - 1)) === 0
  }

  private createTex(gl: WebGLRenderingContext, source: HTMLImageElement | HTMLCanvasElement, repeat: boolean, useMipmap: boolean): WebGLTexture | null {
    const tex = gl.createTexture()
    if (!tex) return null
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)

    const w = source instanceof HTMLImageElement ? source.naturalWidth || source.width : source.width
    const h = source instanceof HTMLImageElement ? source.naturalHeight || source.height : source.height
    const canMipmap = useMipmap && this.isPowerOfTwo(w) && this.isPowerOfTwo(h)

    if (canMipmap) {
      gl.generateMipmap(gl.TEXTURE_2D)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE)
    return tex
  }

  public render(scene: HTMLCanvasElement, timeSec: number, dayNightBlend: number, config: WaterShaderConfig = DEFAULT_WATER_CONFIG): HTMLCanvasElement | null {
    if (!config.enabled || !this.isReady || this.hasFailed || !this.gl || !this.program || !this.sceneCrop) {
      return null
    }

    const { x, y, w, h } = STREAM_BOUNDS
    this.sceneCrop.drawImage(scene, x, y, w, h, 0, 0, w, h)
    const gl = this.gl
    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    gl.useProgram(this.program)

    const bindUnit = (unit: number, tex: WebGLTexture | null, uLoc: WebGLUniformLocation | null) => {
      gl.activeTexture(gl.TEXTURE0 + unit)
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.uniform1i(uLoc, unit)
    }

    bindUnit(0, this.textures.scene, this.uniforms.uScene)
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.sceneCrop.canvas)
    bindUnit(1, this.textures.waterMask, this.uniforms.uWaterMask)
    bindUnit(2, this.textures.dayBanks, this.uniforms.uDayBanks)
    bindUnit(3, this.textures.nightBanks, this.uniforms.uNightBanks)
    bindUnit(4, this.textures.flowMap, this.uniforms.uFlowMap)
    bindUnit(5, this.textures.normalMap, this.uniforms.uNormalMap)

    gl.uniform1f(this.uniforms.uTime, timeSec)
    gl.uniform1f(this.uniforms.uDayNightBlend, dayNightBlend)
    gl.uniform1f(this.uniforms.uFlowStrength, config.flowStrength)
    gl.uniform1f(this.uniforms.uFlowSpeed, config.flowSpeed)
    gl.uniform1f(this.uniforms.uNormalStrength, config.normalStrength)
    gl.uniform1f(this.uniforms.uHighlightStrength, config.highlightStrength)
    gl.uniform1f(this.uniforms.uFlowOnlyMode, config.flowOnlyMode ? 1.0 : 0.0)
    gl.uniform1f(this.uniforms.uFlowDirSign, config.reverseFlow ? -1.0 : 1.0)

    gl.drawArrays(gl.TRIANGLES, 0, 6)
    return this.canvas
  }
}
