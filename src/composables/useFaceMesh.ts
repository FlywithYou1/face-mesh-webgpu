import { ref, watch, onUnmounted, type Ref } from 'vue'
import * as THREE from 'three'
import type {
  BufferGeometry,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Scene,
  Texture,
  WebGLRenderer
} from 'three'
import { WebGPURenderer } from 'three/webgpu'
import { UVS } from './uv_coords.js'
import graphBinary from '@mediapipe/face_mesh/face_mesh.binarypb?url'
import packedAssets from '@mediapipe/face_mesh/face_mesh_solution_packed_assets.data?url'
import packedAssetsLoader from '@mediapipe/face_mesh/face_mesh_solution_packed_assets_loader.js?url'
import simdWasm from '@mediapipe/face_mesh/face_mesh_solution_simd_wasm_bin.wasm?url'
import simdWasmLoader from '@mediapipe/face_mesh/face_mesh_solution_simd_wasm_bin.js?url'
import wasm from '@mediapipe/face_mesh/face_mesh_solution_wasm_bin.wasm?url'
import wasmLoader from '@mediapipe/face_mesh/face_mesh_solution_wasm_bin.js?url'

type Landmark = { x: number; y: number; z: number }

type FaceMeshResult = {
  multiFaceLandmarks?: Landmark[][]
  multiFaceGeometry?: Array<{ getMesh(): { getIndexBufferList(): Uint16Array } }>
}

type FaceMeshInstance = {
  initialize(): Promise<void>
  close(): Promise<void>
  reset?: () => void
  onResults(cb: (results: FaceMeshResult) => void): void
  send(input: { image: HTMLVideoElement | HTMLCanvasElement }): Promise<void>
  setOptions(options: Record<string, unknown>): void
}

type FaceMeshConstructor = new (config: { locateFile: (file: string) => string }) => FaceMeshInstance

type CameraConfig = {
  onFrame: () => Promise<void> | void
  width?: number
  height?: number
  facingMode?: 'user' | 'environment'
}

type CameraInstance = {
  start(): Promise<void>
  stop(): Promise<void>
}

type CameraConstructor = new (video: HTMLVideoElement, config: CameraConfig) => CameraInstance

type Renderer = WebGLRenderer | WebGPURenderer
type RendererWithLoop = Renderer & { setAnimationLoop: (callback: (() => void) | null) => void }

// 常量配置
const FACE_MESH_VERSION = '0.4.1633559619'
const MAX_POINTS = 468
const CAMERA_Z = 2 // 相机距离
const CAMERA_FOV = 63 // 更接近真实摄像头的 FOV
const FACE_LOST_RESET_FRAMES = 120 // 丢脸超过该帧数，自动 reset 管线
const BUNDLED_FACE_MESH_ASSETS: Record<string, string> = {
  'face_mesh.binarypb': graphBinary,
  'face_mesh_solution_packed_assets.data': packedAssets,
  'face_mesh_solution_packed_assets_loader.js': packedAssetsLoader,
  'face_mesh_solution_simd_wasm_bin.js': simdWasmLoader,
  'face_mesh_solution_simd_wasm_bin.wasm': simdWasm,
  'face_mesh_solution_wasm_bin.js': wasmLoader,
  'face_mesh_solution_wasm_bin.wasm': wasm
}

export function useFaceMesh(videoRef: Ref<HTMLVideoElement | null>, canvasContainer: Ref<HTMLElement | null>) {
  // 状态
  const isLoading = ref(true)
  const errorMessage = ref('')
  const isFaceDetected = ref(false)
  const hasGeometry = ref(false)
  const rendererType = ref('检测中...')
  const fps = ref(0)
  const isRecording = ref(false)

  // 显示控制
  const viewMode = ref<'camera' | 'model'>('camera')
  const showWireframe = ref(true)
  const opacity = ref(0.5)
  const meshDensity = ref<'high' | 'low'>('high')
  const pointSize = ref(3)
  const pointColor = ref('#6ee7ff')
  const wireframeColor = ref('#ffffff')
  const materialType = ref<'wireframe' | 'hologram' | 'solid' | 'texture'>('wireframe')
  const glowIntensity = ref(0)
  const cdnSource = ref<'auto' | 'jsdelivr' | 'unpkg' | 'local'>('auto')
  const showParticles = ref(false)
  const showHat = ref(false)

  // 内部变量
  let camera: CameraInstance | null = null
  let faceMesh: FaceMeshInstance | null = null
  let scene: Scene | null = null
  let threeCamera: PerspectiveCamera | null = null
  let renderer: Renderer | null = null
  let faceGeometry: BufferGeometry | null = null
  let faceMaterial: MeshStandardMaterial | null = null
  let faceMeshObject: Mesh<BufferGeometry, MeshStandardMaterial> | null = null
  let pointCloud: Points<BufferGeometry, PointsMaterial> | null = null
  let pointsGeometry: BufferGeometry | null = null
  let pointsMaterial: PointsMaterial | null = null
  let particleSystem: Points<BufferGeometry, PointsMaterial> | null = null
  let particlesGeometry: BufferGeometry | null = null
  let particlesMaterial: PointsMaterial | null = null
  let hatObject: Mesh<THREE.ConeGeometry, THREE.MeshPhongMaterial> | null = null
  let lastTime = 0
  let frameCount = 0
  let normalsFrame = 0
  let loadingTimer: number | null = null
  let animationLoopAttached = false
  let triangulationIndices: Uint16Array | null = null
  let faceMissingFrames = 0
  let mediaRecorder: MediaRecorder | null = null
  let recordedChunks: Blob[] = []
  let currentTexture: Texture | null = null
  let resizeListenerAttached = false

  const isMobile = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer:coarse)').matches

  const getViewportSize = () => {
    const width = canvasContainer.value?.clientWidth || window.innerWidth
    const height = canvasContainer.value?.clientHeight || window.innerHeight
    return { width, height }
  }

  // --- 资源清理 ---
  const disposeResources = () => {
    stopRecording()
    detachResizeListener()
    const loopRenderer = renderer as RendererWithLoop | null
    if (loopRenderer) {
      loopRenderer.setAnimationLoop(null)
      animationLoopAttached = false
      if (loopRenderer.domElement?.parentElement) {
        loopRenderer.domElement.parentElement.removeChild(loopRenderer.domElement)
      }
    }
    pointsGeometry?.dispose()
    faceGeometry?.dispose()
    pointsMaterial?.dispose()
    faceMaterial?.dispose()
    particlesGeometry?.dispose()
    particlesMaterial?.dispose()
    currentTexture?.dispose()

    renderer?.dispose()

    pointCloud = null
    faceMeshObject = null
    particleSystem = null
    hatObject = null
    faceMaterial = null
    faceGeometry = null
    pointsGeometry = null
    pointsMaterial = null
    particlesGeometry = null
    particlesMaterial = null
    scene = null
    renderer = null
    threeCamera = null

    // 重置状态
    isFaceDetected.value = false
    hasGeometry.value = false
    triangulationIndices = null
    normalsFrame = 0
    mediaRecorder = null
    recordedChunks = []
  }

  const stopMedia = async () => {
    if (camera) {
      try {
        await camera.stop()
      } catch (e) {
        console.warn(e)
      }
      camera = null
    }
    if (faceMesh?.close) {
      try {
        await faceMesh.close()
      } catch (e) {
        console.warn(e)
      }
      faceMesh = null
    }
  }

  // --- Three.js 初始化 ---
  const createRenderer = async (width: number, height: number): Promise<Renderer | null> => {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2)
    if (typeof navigator !== 'undefined' && (navigator as Navigator & { gpu?: unknown }).gpu) {
      try {
        const webgpuRenderer = new WebGPURenderer({ antialias: true, alpha: true })
        await webgpuRenderer.init()
        webgpuRenderer.setSize(width, height)
        webgpuRenderer.setPixelRatio(pixelRatio)
        rendererType.value = 'WebGPU'
        return webgpuRenderer
      } catch (e) {
        console.warn('WebGPU 初始化失败，回退到 WebGL', e)
      }
    }

    const webglRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    webglRenderer.setSize(width, height)
    webglRenderer.setPixelRatio(pixelRatio)
    rendererType.value = 'WebGL'
    return webglRenderer
  }

  const initThreeJS = async () => {
    const { width, height } = getViewportSize()

    scene = new THREE.Scene()

    // 相机设置
    threeCamera = new THREE.PerspectiveCamera(CAMERA_FOV, width / height, 0.1, 1000)
    threeCamera.position.z = CAMERA_Z

    renderer = await createRenderer(width, height)
    if (!renderer) throw new Error('渲染器初始化失败')

    renderer.setClearColor(0x000000, 0)
    Object.assign(renderer.domElement.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none'
    })

    if (canvasContainer.value) {
      canvasContainer.value.appendChild(renderer.domElement)
    }

    // 灯光
    scene.add(new THREE.AmbientLight(0xffffff, 0.5))
    const dirLight = new THREE.DirectionalLight(0xffffff, 1)
    dirLight.position.set(0, 1, 1)
    scene.add(dirLight)

    // 几何体初始化
    const positions = new Float32Array(MAX_POINTS * 3)

    // 1. 点云
    pointsGeometry = new THREE.BufferGeometry()
    pointsGeometry.setAttribute('position', new THREE.BufferAttribute(positions.slice(), 3))
    pointsMaterial = new THREE.PointsMaterial({
      color: new THREE.Color(pointColor.value),
      size: pointSize.value,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.9,
      depthTest: false
    })
    pointCloud = new THREE.Points(pointsGeometry, pointsMaterial)
    pointCloud.frustumCulled = false
    scene.add(pointCloud)

    // 2. 面部网格
    faceGeometry = new THREE.BufferGeometry()
    faceGeometry.setAttribute('position', new THREE.BufferAttribute(positions.slice(), 3))

    // 添加 UV 坐标
    const uvArray = new Float32Array(MAX_POINTS * 2)
    for (let i = 0; i < MAX_POINTS; i++) {
      if (i < UVS.length) {
        uvArray[i * 2] = UVS[i][0]
        uvArray[i * 2 + 1] = 1.0 - UVS[i][1] // Flip Y
      }
    }
    faceGeometry.setAttribute('uv', new THREE.BufferAttribute(uvArray, 2))

    faceMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(wireframeColor.value),
      wireframe: true,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5,
      flatShading: true,
      roughness: 0.5,
      metalness: 0.1
    })
    faceMeshObject = new THREE.Mesh(faceGeometry, faceMaterial)
    faceMeshObject.frustumCulled = false
    scene.add(faceMeshObject)

    // 3. 粒子系统 (简单示例：从鼻子发射)
    const particleCount = 100
    particlesGeometry = new THREE.BufferGeometry()
    const pPositions = new Float32Array(particleCount * 3)
    const pVelocities: Array<{ x: number; y: number; z: number }> = []
    for (let i = 0; i < particleCount; i++) {
      pPositions[i * 3] = 0; pPositions[i * 3 + 1] = 0; pPositions[i * 3 + 2] = 0
      pVelocities.push({ x: (Math.random() - 0.5) * 0.02, y: (Math.random() - 0.5) * 0.02, z: (Math.random() - 0.5) * 0.02 })
    }
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(pPositions, 3))
    particlesMaterial = new THREE.PointsMaterial({
      color: 0xffaa00,
      size: 5,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    })
    particleSystem = new THREE.Points(particlesGeometry, particlesMaterial)
    particleSystem.userData = { velocities: pVelocities }
    particleSystem.visible = false
    scene.add(particleSystem)

    // 4. 虚拟物体 (帽子)
    const hatGeo = new THREE.ConeGeometry(0.15, 0.3, 32)
    const hatMat = new THREE.MeshPhongMaterial({ color: 0xff0000 })
    hatObject = new THREE.Mesh(hatGeo, hatMat)
    hatObject.visible = false
    scene.add(hatObject)

    attachResizeListener()
    updateVisibility()

    // 动画循环
    ;(renderer as RendererWithLoop).setAnimationLoop(() => {
      if (!scene || !threeCamera) return
      // 简单的脉冲发光动画
      if (materialType.value === 'hologram' && faceMaterial) {
        const time = performance.now() * 0.001
        faceMaterial.opacity = 0.3 + Math.sin(time * 2) * 0.1
      }

      // 粒子动画
      if (showParticles.value && particleSystem && isFaceDetected.value && faceMeshObject) {
        const positionsAttr = particleSystem.geometry.attributes.position
        const positions = positionsAttr.array as Float32Array
        const velocities = (particleSystem.userData.velocities ?? []) as Array<{ x: number; y: number; z: number }>
        // 假设鼻子尖是索引 4
        const noseIndex = 4
        const meshPositions = faceMeshObject.geometry.attributes.position.array as Float32Array
        const noseX = meshPositions[noseIndex * 3]
        const noseY = meshPositions[noseIndex * 3 + 1]
        const noseZ = meshPositions[noseIndex * 3 + 2]

        for (let i = 0; i < particleCount; i++) {
          positions[i * 3] += velocities[i].x
          positions[i * 3 + 1] += velocities[i].y
          positions[i * 3 + 2] += velocities[i].z

          // 简单重置逻辑
          if (Math.abs(positions[i * 3] - noseX) > 0.5 || Math.random() < 0.02) {
            positions[i * 3] = noseX
            positions[i * 3 + 1] = noseY
            positions[i * 3 + 2] = noseZ
          }
        }
        positionsAttr.needsUpdate = true
      }

      renderer.render(scene, threeCamera)

      const now = performance.now()
      frameCount++
      if (now - lastTime >= 1000) {
        fps.value = frameCount
        frameCount = 0
        lastTime = now
      }
    })
    animationLoopAttached = true
  }

  // --- 核心逻辑：坐标对齐与更新 ---
  const onResults = (results: FaceMeshResult) => {
    if (!pointCloud || !faceMeshObject || !threeCamera) return
    isLoading.value = false
    errorMessage.value = ''
    if (loadingTimer !== null) clearTimeout(loadingTimer)

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
      isFaceDetected.value = true
      faceMissingFrames = 0
      const landmarks = results.multiFaceLandmarks[0]

      // 获取三角剖分索引
      if (!triangulationIndices && results.multiFaceGeometry && results.multiFaceGeometry.length > 0) {
        try {
          const indices = results.multiFaceGeometry[0].getMesh().getIndexBufferList()
          triangulationIndices = indices
          faceGeometry?.setIndex(new THREE.BufferAttribute(indices, 1))
          hasGeometry.value = true
        } catch (e) { console.warn('无法提取索引', e) }
      } else if (triangulationIndices) {
        hasGeometry.value = true
      }

      // 坐标计算
      const positions = pointCloud.geometry.attributes.position.array as Float32Array
      const meshPositions = faceMeshObject.geometry.attributes.position.array as Float32Array

      const video = videoRef.value
      if (!video || video.videoWidth === 0) return

      // 1. 计算视频渲染尺寸 (object-cover 模拟)
      const videoW = video.videoWidth
      const videoH = video.videoHeight
      const { width: screenW, height: screenH } = getViewportSize()
      const videoAspect = videoW / videoH
      const screenAspect = screenW / screenH

      let renderW: number, renderH: number
      if (screenAspect > videoAspect) {
        renderW = screenW
        renderH = screenW / videoAspect
      } else {
        renderH = screenH
        renderW = screenH * videoAspect
      }

      // 2. Three.js 视口参数
      const fovRad = threeCamera.fov * (Math.PI / 180)
      // 在 z=0 (即相机前方 distance 处) 的可视高度
      const visibleHeightAtZero = 2 * Math.tan(fovRad / 2) * CAMERA_Z
      // 像素到世界单位的比例 (在 z=0 平面)
      const pxToWorld = visibleHeightAtZero / screenH

      // 3. 顶点更新
      const targetPoints = meshDensity.value === 'low' ? 156 : landmarks.length
      const step = meshDensity.value === 'low' ? Math.ceil(landmarks.length / targetPoints) : 1
      let drawCount = 0

      for (let i = 0; i < MAX_POINTS; i++) {
        if (i < landmarks.length) {
          const landmark = landmarks[i]

          // 2D 像素坐标偏移 (相对于屏幕中心)
          // landmark.x/y 是相对于视频帧的 0-1
          const dx = (landmark.x - 0.5) * renderW
          const dy = (landmark.y - 0.5) * renderH

          // 原始 Z 深度 (估算值)
          // landmark.z 是相对于头部宽度的比例，需要缩放
          // 这里的系数 1.5 是经验值，用于调整 3D 深度感
          const zDepth = -landmark.z * renderW * pxToWorld * 1.5

          // --- 透视修正核心逻辑 ---
          // 顶点在世界坐标系中的实际 Z 值 (假设物体在相机前方)
          // 物体 Z = 0 时，depth = CAMERA_Z
          // 我们希望 zDepth 表现为相对于 Z=0 平面的偏移
          const worldZ = zDepth

          // 顶点到相机的距离
          const distanceToCamera = CAMERA_Z - worldZ

          // 透视投影补偿因子
          // 当点远离相机时 (distance > CAMERA_Z)，它在屏幕上会变小
          // 为了让它投影回屏幕时依然对齐 MediaPipe 的 2D 坐标，我们需要放大它的 X/Y
          const perspectiveFactor = distanceToCamera / CAMERA_Z

          const x = dx * pxToWorld * perspectiveFactor
          const y = -dy * pxToWorld * perspectiveFactor
          const z = worldZ

          const base = i * 3

          // 更新网格 (全量)
          meshPositions[base] = x
          meshPositions[base + 1] = y
          meshPositions[base + 2] = z

          // 更新点云 (抽样，压紧 drawRange 前部)
          if (i % step === 0 && drawCount < MAX_POINTS) {
            const pointBase = drawCount * 3
            positions[pointBase] = x
            positions[pointBase + 1] = y
            positions[pointBase + 2] = z
            drawCount++
          }
        }
      }

      pointCloud.geometry.setDrawRange(0, drawCount)
      pointCloud.geometry.attributes.position.needsUpdate = true
      faceMeshObject.geometry.setDrawRange(0, landmarks.length)
      faceMeshObject.geometry.attributes.position.needsUpdate = true

      // 更新帽子位置 (简单绑定到额头中心: 10)
      if (showHat.value && hatObject) {
        const foreheadIndex = 10
        const x = meshPositions[foreheadIndex * 3]
        const y = meshPositions[foreheadIndex * 3 + 1]
        const z = meshPositions[foreheadIndex * 3 + 2]
        hatObject.position.set(x, y + 0.2, z)
        // 简单旋转跟随 (可以优化为使用旋转矩阵)
        // hatObject.lookAt(camera.position)
      }

      // 法线计算优化
      if (faceMeshObject.visible && triangulationIndices && (normalsFrame++ % 6 === 0)) {
        faceMeshObject.geometry.computeVertexNormals()
      }
    } else {
      faceMissingFrames += 1
      if (faceMissingFrames > 12) {
        // 连续多帧未检测到人脸才判定丢失，减少抖动
        isFaceDetected.value = false
      }

      // 连续长时间无脸，尝试 reset 提高恢复概率
      if (faceMissingFrames === FACE_LOST_RESET_FRAMES) {
        console.warn('Face lost for a while, resetting FaceMesh graph...')
        try { faceMesh?.reset?.() } catch (e) { console.warn('FaceMesh reset failed', e) }
      }
    }
  }

  // --- 可见性更新 ---
  const updateVisibility = () => {
    if (!pointCloud || !faceMeshObject) return

    if (viewMode.value === 'camera') {
      pointCloud.visible = true
      faceMeshObject.visible = false
      if (videoRef.value) videoRef.value.style.display = 'block'
    } else {
      const canShowMesh = hasGeometry.value
      pointCloud.visible = !canShowMesh
      faceMeshObject.visible = canShowMesh

      if (faceMaterial) {
        faceMaterial.wireframe = showWireframe.value
        faceMaterial.opacity = opacity.value
      }
      if (videoRef.value) videoRef.value.style.display = 'none'
    }

    if (pointsMaterial) {
      pointsMaterial.size = pointSize.value
      pointsMaterial.color.set(pointColor.value)
    }

    if (particleSystem) particleSystem.visible = showParticles.value
    if (hatObject) hatObject.visible = showHat.value

    if (faceMaterial) {
      const color = new THREE.Color(wireframeColor.value)
      faceMaterial.color.set(color)
      faceMaterial.map = null // Reset texture by default
      faceMaterial.needsUpdate = true

      // 材质类型切换
      switch (materialType.value) {
        case 'wireframe':
          faceMaterial.wireframe = true
          faceMaterial.transparent = true
          faceMaterial.opacity = opacity.value
          faceMaterial.side = THREE.DoubleSide
          faceMaterial.blending = THREE.NormalBlending
          faceMaterial.roughness = 0.5
          faceMaterial.metalness = 0.1
          faceMaterial.emissive.setHex(0x000000)
          faceMaterial.emissiveIntensity = 0
          break
        case 'hologram':
          faceMaterial.wireframe = false
          faceMaterial.transparent = true
          faceMaterial.opacity = opacity.value * 0.6
          faceMaterial.side = THREE.DoubleSide
          faceMaterial.blending = THREE.AdditiveBlending
          faceMaterial.roughness = 0.1
          faceMaterial.metalness = 0.8
          // 全息模式下启用发光
          faceMaterial.emissive.set(color)
          faceMaterial.emissiveIntensity = 0.5 + glowIntensity.value
          break
        case 'solid':
          faceMaterial.wireframe = false
          faceMaterial.transparent = opacity.value < 1
          faceMaterial.opacity = opacity.value
          faceMaterial.side = THREE.FrontSide
          faceMaterial.blending = THREE.NormalBlending
          faceMaterial.roughness = 0.3
          faceMaterial.metalness = 0.6
          // 实体模式下根据强度发光
          faceMaterial.emissive.set(color)
          faceMaterial.emissiveIntensity = glowIntensity.value * 0.5
          break
        case 'texture':
          faceMaterial.wireframe = false
          faceMaterial.transparent = opacity.value < 1
          faceMaterial.opacity = opacity.value
          faceMaterial.side = THREE.DoubleSide
          faceMaterial.blending = THREE.NormalBlending
          faceMaterial.roughness = 0.5
          faceMaterial.metalness = 0.0
          faceMaterial.emissive.setHex(0x000000)
          faceMaterial.emissiveIntensity = 0
          if (currentTexture) {
            faceMaterial.map = currentTexture
            faceMaterial.color.setHex(0xffffff) // Reset color for texture
          }
          break
      }
    }
  }

  watch([viewMode, showWireframe, opacity, meshDensity, hasGeometry, pointSize, pointColor, wireframeColor, materialType, glowIntensity, showParticles, showHat], updateVisibility)

  // --- 纹理加载 ---
  const loadTexture = (file: File | null) => {
    if (!file) return
    if (currentTexture) {
      currentTexture.dispose()
      currentTexture = null
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result
      if (typeof result !== 'string') return
      const img = new Image()
      img.onload = () => {
        const texture = new THREE.Texture(img)
        texture.needsUpdate = true
        currentTexture = texture
        materialType.value = 'texture' // Auto switch
        updateVisibility()
      }
      img.src = result
    }
    reader.readAsDataURL(file)
  }

  // --- 截图功能 ---
  const captureScreenshot = async () => {
    if (!renderer || !videoRef.value || !scene || !threeCamera) return

    // 1. 创建临时 Canvas
    const canvas = document.createElement('canvas')
    canvas.width = renderer.domElement.width
    canvas.height = renderer.domElement.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 2. 绘制视频背景
    // 需要处理镜像翻转
    ctx.save()
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(videoRef.value, 0, 0, canvas.width, canvas.height)
    ctx.restore()

    // 3. 绘制 Three.js 内容
    // 强制渲染一帧以确保缓冲区最新
    renderer.render(scene, threeCamera)
    ctx.drawImage(renderer.domElement, 0, 0)

    // 4. 导出图片
    const dataUrl = canvas.toDataURL('image/png')
    const link = document.createElement('a')
    link.download = `face-mesh-${Date.now()}.png`
    link.href = dataUrl
    link.click()
  }

  // --- 录制功能 ---
  const startRecording = () => {
    if (!renderer || !videoRef.value || !scene || !threeCamera) return
    if (mediaRecorder && mediaRecorder.state === 'recording') return
    if (typeof MediaRecorder === 'undefined') {
      errorMessage.value = '当前浏览器不支持录像功能'
      return
    }

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
        ? 'video/webm;codecs=vp8'
        : MediaRecorder.isTypeSupported('video/webm')
          ? 'video/webm'
          : ''

    if (!mimeType) {
      errorMessage.value = '当前浏览器不支持 WebM 录像格式'
      return
    }

    // 创建混合 Canvas
    const canvas = document.createElement('canvas')
    canvas.width = renderer.domElement.width
    canvas.height = renderer.domElement.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const stream = canvas.captureStream(30) // 30 FPS
    mediaRecorder = new MediaRecorder(stream, { mimeType })
    recordedChunks = []

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data)
    }

    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: 'video/webm' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `face-mesh-video-${Date.now()}.webm`
      a.click()
      URL.revokeObjectURL(url)
      isRecording.value = false
      mediaRecorder = null
      recordedChunks = []
    }

    // 启动混合绘制循环
    const drawLoop = () => {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        // 绘制视频
        ctx.save()
        ctx.translate(canvas.width, 0)
        ctx.scale(-1, 1)
        ctx.drawImage(videoRef.value as HTMLVideoElement, 0, 0, canvas.width, canvas.height)
        ctx.restore()

        // 绘制 3D
        renderer.render(scene as Scene, threeCamera as PerspectiveCamera)
        ctx.drawImage(renderer.domElement, 0, 0)

        requestAnimationFrame(drawLoop)
      }
    }

    mediaRecorder.start()
    isRecording.value = true
    drawLoop()
  }

  const stopRecording = () => {
    if (mediaRecorder) {
      if (mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop()
      } else {
        mediaRecorder.ondataavailable = null
        mediaRecorder.onstop = null
        mediaRecorder = null
        recordedChunks = []
      }
    }
  }

  // --- 窗口大小调整 ---
  const onResize = () => {
    if (!threeCamera || !renderer) return
    const { width, height } = getViewportSize()
    threeCamera.aspect = width / height
    threeCamera.updateProjectionMatrix()
    renderer.setSize(width, height)
  }

  const attachResizeListener = () => {
    if (!resizeListenerAttached) {
      window.addEventListener('resize', onResize)
      resizeListenerAttached = true
    }
  }

  const detachResizeListener = () => {
    if (resizeListenerAttached) {
      window.removeEventListener('resize', onResize)
      resizeListenerAttached = false
    }
  }

  // --- 启动流程 ---
  const start = async () => {
    await stopMedia()
    disposeResources()
    errorMessage.value = ''
    isLoading.value = true

    // 1. 权限预检
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      stream.getTracks().forEach(t => t.stop())
    } catch (e) {
      console.warn('权限预检失败', e)
    }

    // 2. 超时保护
    loadingTimer = window.setTimeout(() => {
      if (isLoading.value) {
        errorMessage.value = '初始化超时，请检查网络或权限。'
        isLoading.value = false
      }
    }, 15000)

    // 3. 初始化 Three.js
    try {
      await initThreeJS()
    } catch (e) {
      errorMessage.value = '渲染引擎初始化失败'
      isLoading.value = false
      return
    }

    // 4. 加载 MediaPipe
    try {
      const [faceMeshModule, cameraUtilsModule] = await Promise.all([
        import('@mediapipe/face_mesh'),
        import('@mediapipe/camera_utils')
      ])

      // 尝试多种方式获取构造函数
      const FaceMeshCtor =
        (faceMeshModule as { FaceMesh?: FaceMeshConstructor }).FaceMesh ||
        (faceMeshModule as { default?: { FaceMesh?: FaceMeshConstructor } }).default?.FaceMesh ||
        (faceMeshModule as { default?: FaceMeshConstructor }).default ||
        (typeof window !== 'undefined' ? (window as typeof window & { FaceMesh?: FaceMeshConstructor }).FaceMesh : undefined) ||
        (typeof globalThis !== 'undefined' ? (globalThis as typeof globalThis & { FaceMesh?: FaceMeshConstructor }).FaceMesh : undefined)

      const CameraCtor =
        (cameraUtilsModule as { Camera?: CameraConstructor }).Camera ||
        (cameraUtilsModule as { default?: { Camera?: CameraConstructor } }).default?.Camera ||
        (cameraUtilsModule as { default?: CameraConstructor }).default ||
        (typeof window !== 'undefined' ? (window as typeof window & { Camera?: CameraConstructor }).Camera : undefined) ||
        (typeof globalThis !== 'undefined' ? (globalThis as typeof globalThis & { Camera?: CameraConstructor }).Camera : undefined)

      if (!FaceMeshCtor) throw new Error('FaceMesh 构造函数未找到')
      if (!CameraCtor) throw new Error('Camera 构造函数未找到')

      const resolveCdnBases = () => {
        const localBase = `${window.location.origin}/mediapipe/face_mesh/`
        if (cdnSource.value === 'jsdelivr') return [`https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@${FACE_MESH_VERSION}/`]
        if (cdnSource.value === 'unpkg') return [`https://unpkg.com/@mediapipe/face_mesh@${FACE_MESH_VERSION}/`]
        if (cdnSource.value === 'local') return [localBase]

        // auto: 优先 unpkg (更稳定)，其次 jsdelivr，最后本地
        return [
          `https://unpkg.com/@mediapipe/face_mesh@${FACE_MESH_VERSION}/`,
          `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@${FACE_MESH_VERSION}/`,
          localBase
        ]
      }

      const bases = resolveCdnBases()
      let lastError: Error | null = null

      for (const base of bases) {
        try {
          console.log('Initializing FaceMesh with resource base:', base)
          const locateFile = (file: string) => BUNDLED_FACE_MESH_ASSETS[file] || `${base}${file}`
          faceMesh = new FaceMeshCtor({ locateFile })
          faceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: false,
            minDetectionConfidence: 0.25,
            minTrackingConfidence: 0.25,
            enableFaceGeometry: true,
            selfieMode: true
          })
          faceMesh.onResults(onResults)

          console.log('Starting FaceMesh initialization...')
          await faceMesh.initialize()
          console.log('FaceMesh initialized successfully')
          lastError = null
          break
        } catch (e) {
          console.error(`FaceMesh init failed on base ${base}:`, e)
          lastError = e instanceof Error ? e : new Error(String(e))
          try { await faceMesh?.close() } catch (_) { /* noop */ }
          faceMesh = null
        }
      }

      if (!faceMesh) {
        throw new Error(lastError?.message ? `FaceMesh 初始化失败，尝试源: ${bases.join(', ')}，最后错误: ${lastError.message}` : 'FaceMesh 初始化失败')
      }

      // 5. 启动摄像头
      if (!videoRef.value) throw new Error('未找到视频元素')

      camera = new CameraCtor(videoRef.value, {
        onFrame: async () => {
          if (faceMesh) {
            try {
              await faceMesh.send({ image: videoRef.value as HTMLVideoElement })
            } catch (e) {
              console.error('FaceMesh send error:', e)
            }
          }
        },
        width: isMobile ? 960 : 1280,
        height: isMobile ? 540 : 720,
        facingMode: 'user'
      })

      console.log('Starting Camera...')
      try {
        await camera.start()
      } catch (e) {
        const err = e as Error & { name?: string; message?: string }
        const reason = err?.name === 'NotAllowedError'
          ? '无法访问摄像头：浏览器拒绝了权限，请在地址栏左侧的相机权限设置中允许访问后重试。'
          : `无法访问摄像头：${err?.message || err}`
        throw new Error(reason)
      }
      console.log('Camera started')

      isLoading.value = false
      if (loadingTimer !== null) clearTimeout(loadingTimer)
      updateVisibility()

    } catch (e) {
      console.error('Setup failed:', e)
      errorMessage.value = e instanceof Error ? e.message : '启动失败'
      isLoading.value = false
      disposeResources()
    }
  }

  onUnmounted(() => {
    stopMedia()
    disposeResources()
    detachResizeListener()
    if (loadingTimer !== null) clearTimeout(loadingTimer)
  })

  return {
    // 状态
    isLoading,
    errorMessage,
    isFaceDetected,
    hasGeometry,
    rendererType,
    fps,
    isRecording,
    // 设置
    viewMode,
    pointColor,
    wireframeColor,
    showWireframe,
    opacity,
    meshDensity,
    pointSize,
    cdnSource,
    materialType,
    glowIntensity,
    showParticles,
    showHat,
    // 方法
    start,
    retry: start,
    captureScreenshot,
    startRecording,
    stopRecording,
    loadTexture
  }
}