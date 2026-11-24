type WindRegion = {
  name: string
  tip: [number, number]
  anchor: [number, number]
  radius: [number, number]
  amplitude: number
  foliage?: 'meadow' | 'card'
}

export const HERO_WIND_REGIONS: WindRegion[] = [
  { name: '左侧外展叶尖', tip: [486, 243], anchor: [664, 193], radius: [81, 61], amplitude: 13 },
  { name: '左侧下垂叶尖', tip: [500, 369], anchor: [648, 314], radius: [79, 57], amplitude: 13 },
  { name: '左缘靠卡垂叶', tip: [624, 405], anchor: [639, 333], radius: [28, 46], amplitude: 7.5 },
  { name: '左上外缘嫩叶', tip: [615, 118], anchor: [736, 151], radius: [74, 64], amplitude: 12 },
  { name: '左上树冠', tip: [716, 43], anchor: [809, 103], radius: [73, 58], amplitude: 11 },
  { name: '左中树冠', tip: [860, 35], anchor: [950, 91], radius: [87, 61], amplitude: 10 },
  { name: '中部树冠', tip: [994, 63], anchor: [1049, 99], radius: [89, 62], amplitude: 9.4 },
  { name: '中部下垂嫩叶', tip: [1130, 83], anchor: [1088, 28], radius: [65, 49], amplitude: 8.7 },
  { name: '中右树冠', tip: [1200, 37], anchor: [1293, 72], radius: [71, 55], amplitude: 8.3 },
  { name: '右上树冠', tip: [1600, 52], anchor: [1510, 92], radius: [91, 68], amplitude: 10 },
  { name: '右缘小叶', tip: [1651, 190], anchor: [1608, 223], radius: [44, 35], amplitude: 6.8 },
  { name: '右侧外伸叶尖', tip: [1641, 338], anchor: [1570, 284], radius: [63, 62], amplitude: 9.3 },
  { name: '右侧下垂叶尖', tip: [1624, 428], anchor: [1590, 369], radius: [51, 43], amplitude: 8.9 },
  { name: '卡框左上垂叶', tip: [833, 281], anchor: [852, 238], radius: [33, 29], amplitude: 5.5, foliage: 'card' },
  { name: '卡框左中垂叶', tip: [999, 287], anchor: [1019, 238], radius: [38, 31], amplitude: 5, foliage: 'card' },
  { name: '卡框中部垂叶', tip: [1179, 290], anchor: [1196, 244], radius: [39, 29], amplitude: 4.7, foliage: 'card' },
  { name: '卡框右上垂叶', tip: [1266, 276], anchor: [1284, 241], radius: [31, 26], amplitude: 4.2, foliage: 'card' },
  { name: '左岸高花', tip: [58, 757], anchor: [36, 819], radius: [35, 50], amplitude: 10, foliage: 'meadow' },
  { name: '左岸小花', tip: [102, 782], anchor: [87, 824], radius: [25, 37], amplitude: 9, foliage: 'meadow' },
  { name: '左岸外侧花草', tip: [171, 784], anchor: [142, 817], radius: [25, 23], amplitude: 9.2, foliage: 'meadow' },
  { name: '左下长草', tip: [42, 829], anchor: [43, 931], radius: [62, 94], amplitude: 9.8, foliage: 'meadow' },
  { name: '左下石前花茎', tip: [322, 822], anchor: [300, 889], radius: [24, 30], amplitude: 10.8, foliage: 'meadow' },
  { name: '左下石前细草', tip: [307, 886], anchor: [294, 941], radius: [44, 50], amplitude: 8, foliage: 'meadow' },
  { name: '右岸高花', tip: [1532, 750], anchor: [1523, 799], radius: [30, 43], amplitude: 10.5, foliage: 'meadow' },
  { name: '右岸外侧花草', tip: [1630, 761], anchor: [1613, 838], radius: [53, 67], amplitude: 10.6, foliage: 'meadow' },
  { name: '右下石前高花', tip: [1527, 855], anchor: [1565, 925], radius: [30, 52], amplitude: 10.6, foliage: 'meadow' },
  { name: '右下石前白花', tip: [1425, 902], anchor: [1430, 941], radius: [40, 33], amplitude: 10.4, foliage: 'meadow' },
  { name: '右下长草', tip: [1605, 849], anchor: [1607, 941], radius: [59, 80], amplitude: 9.2, foliage: 'meadow' },
]

const VERTEX_SOURCE = `
attribute vec2 aPosition;
attribute vec2 aOffset;
uniform vec2 uSize;
varying vec2 vUv;

void main() {
  vUv = (aPosition - aOffset) / uSize;
  gl_Position = vec4(aPosition / uSize * vec2(2.0, -2.0) + vec2(-1.0, 1.0), 0.0, 1.0);
}
`

const FRAGMENT_SOURCE = `
precision highp float;
uniform sampler2D uScene;
varying vec2 vUv;

void main() {
  gl_FragColor = texture2D(uScene, vUv);
}
`

function smoothstep(low: number, high: number, value: number) {
  const progress = Math.min(1, Math.max(0, (value - low) / (high - low)))
  return progress * progress * (3 - 2 * progress)
}

function influence(region: WindRegion, x: number, y: number) {
  const [tipX, tipY] = region.tip
  const [anchorX, anchorY] = region.anchor
  const [radiusX, radiusY] = region.radius
  const extent = Math.hypot((x - tipX) / radiusX, (y - tipY) / radiusY)
  if (extent >= 1) return 0

  const stemX = tipX - anchorX
  const stemY = tipY - anchorY
  const along = ((x - anchorX) * stemX + (y - anchorY) * stemY) / (stemX ** 2 + stemY ** 2)
  return smoothstep(0.08, 1, along) * (1 - smoothstep(0.24, 1, extent))
}

function createProgram(gl: WebGLRenderingContext) {
  const program = gl.createProgram()
  if (!program) return null
  for (const [type, source] of [
    [gl.VERTEX_SHADER, VERTEX_SOURCE],
    [gl.FRAGMENT_SHADER, FRAGMENT_SOURCE],
  ] as const) {
    const shader = gl.createShader(type)
    if (!shader) {
      gl.deleteProgram(program)
      return null
    }
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    gl.attachShader(program, shader)
    gl.deleteShader(shader)
  }
  gl.linkProgram(program)
  if (gl.getProgramParameter(program, gl.LINK_STATUS)) return program
  gl.deleteProgram(program)
  return null
}

export function createHeroWindRenderer(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const gl = canvas.getContext('webgl', { alpha: true, antialias: false })
  if (!gl) return null
  const program = createProgram(gl)
  if (!program) return null

  const spacing = 6
  const columns = Math.ceil(width / spacing) + 1
  const rows = Math.ceil(height / spacing) + 1
  const positions = new Float32Array(columns * rows * 2)
  const offsets = new Float32Array(positions.length)
  const regionVertices: { index: number; weight: number }[][] = HERO_WIND_REGIONS.map(() => [])
  const selected = new Uint8Array(columns * rows)
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const index = row * columns + column
      const x = Math.min(width, column * spacing)
      const y = Math.min(height, row * spacing)
      positions[2 * index] = x
      positions[2 * index + 1] = y
      HERO_WIND_REGIONS.forEach((region, regionIndex) => {
        const weight = influence(region, x, y)
        if (weight <= 0) return
        if (region.foliage !== 'card') selected[index] = 1
        regionVertices[regionIndex].push({ index: 2 * index, weight })
      })
    }
  }

  const indices: number[] = []
  const layerIndices: number[] = []
  for (let row = 0; row < rows - 1; row++) {
    for (let column = 0; column < columns - 1; column++) {
      const topLeft = row * columns + column
      const topRight = topLeft + 1
      const bottomLeft = topLeft + columns
      const bottomRight = bottomLeft + 1
      layerIndices.push(topLeft, topRight, bottomLeft, topRight, bottomRight, bottomLeft)
      if (selected[topLeft] || selected[topRight] || selected[bottomLeft] || selected[bottomRight]) {
        indices.push(topLeft, topRight, bottomLeft, topRight, bottomRight, bottomLeft)
      }
    }
  }

  const positionBuffer = gl.createBuffer()
  const offsetBuffer = gl.createBuffer()
  const indexBuffer = gl.createBuffer()
  const layerIndexBuffer = gl.createBuffer()
  const texture = gl.createTexture()
  gl.useProgram(program)
  gl.uniform2f(gl.getUniformLocation(program, 'uSize'), width, height)
  gl.viewport(0, 0, width, height)

  const positionLocation = gl.getAttribLocation(program, 'aPosition')
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)
  gl.enableVertexAttribArray(positionLocation)
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)

  const offsetLocation = gl.getAttribLocation(program, 'aOffset')
  gl.bindBuffer(gl.ARRAY_BUFFER, offsetBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, offsets.byteLength, gl.DYNAMIC_DRAW)
  gl.enableVertexAttribArray(offsetLocation)
  gl.vertexAttribPointer(offsetLocation, 2, gl.FLOAT, false, 0, 0)

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer)
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW)
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, layerIndexBuffer)
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(layerIndices), gl.STATIC_DRAW)
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)

  const motion = HERO_WIND_REGIONS.map(() => ({ x: 0, y: 0 }))
  const uploadOffsets = (card: boolean) => {
    offsets.fill(0)
    regionVertices.forEach((vertices, regionIndex) => {
      if ((HERO_WIND_REGIONS[regionIndex].foliage === 'card') !== card) return
      const { x, y } = motion[regionIndex]
      for (const { index, weight } of vertices) {
        offsets[index] += x * weight
        offsets[index + 1] += y * weight
      }
    })
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, offsets)
  }

  return {
    draw(ctx: CanvasRenderingContext2D, time: number, strength: number, direction: number, gustiness: number, meadow: boolean) {
      const enabled = strength > 0 && !gl.isContextLost()
      HERO_WIND_REGIONS.forEach((region, index) => {
        const active = enabled && (meadow || region.foliage !== 'meadow')
        const phase = index * 0.94
        const gust = 1 + 0.2 * gustiness * Math.sin(time * 0.59 - phase)
        const wave = 0.76 * Math.sin(time * (1.65 + (index % 4) * 0.17) - phase) + 0.24 * Math.sin(time * 2.92 - phase * 1.17)
        const amplitude = active ? region.amplitude * Math.min(0.8, strength) * gust : 0
        motion[index].x = Math.cos(direction) * wave * amplitude
        motion[index].y = (0.32 * Math.sin(direction) * wave + 0.17 * Math.sin(time * 1.94 - phase)) * amplitude
      })
      if (!enabled) return

      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, ctx.canvas)
      uploadOffsets(false)
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0)
      ctx.drawImage(canvas, 0, 0)
    },
    warpCardForeground(foreground: HTMLImageElement | HTMLCanvasElement) {
      if (gl.isContextLost()) return foreground
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, foreground)
      uploadOffsets(true)
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, layerIndexBuffer)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawElements(gl.TRIANGLES, layerIndices.length, gl.UNSIGNED_SHORT, 0)
      return canvas
    },
    offsetAt(x: number, y: number) {
      let offsetX = 0
      let offsetY = 0
      HERO_WIND_REGIONS.forEach((region, index) => {
        const weight = influence(region, x, y)
        offsetX += motion[index].x * weight
        offsetY += motion[index].y * weight
      })
      return [offsetX, offsetY]
    },
    dispose() {
      gl.deleteTexture(texture)
      gl.deleteBuffer(positionBuffer)
      gl.deleteBuffer(offsetBuffer)
      gl.deleteBuffer(indexBuffer)
      gl.deleteBuffer(layerIndexBuffer)
      gl.deleteProgram(program)
    },
  }
}
