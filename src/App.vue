<template>
  <div class="relative w-full h-screen overflow-hidden bg-[#0f172a] font-sans text-white selection:bg-purple-500/30">
    <!-- 视频流：根据模式决定显示或隐藏 -->
    <video
      ref="videoRef"
      class="absolute top-0 left-0 w-full h-full object-cover transform -scale-x-100 transition-opacity duration-500"
      playsinline
      style="display: none;"
    ></video>

    <!-- Three.js 画布容器 -->
    <div ref="canvasContainer" class="absolute top-0 left-0 w-full h-full block pointer-events-none"></div>

    <!-- 控制面板显示开关（移动端/简洁视图） -->
    <button 
      @click="controlsVisible = !controlsVisible"
      class="absolute top-6 right-6 z-20 p-3 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white hover:bg-white/20 transition-all duration-300 shadow-lg"
    >
      <svg v-if="!controlsVisible" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
      <svg v-else xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
    </button>

    <!-- 侧边控制面板 -->
    <transition
      enter-active-class="transition ease-out duration-300"
      enter-from-class="translate-x-full"
      enter-to-class="translate-x-0"
      leave-active-class="transition ease-in duration-200"
      leave-from-class="translate-x-0"
      leave-to-class="translate-x-full"
    >
      <div v-if="controlsVisible" class="absolute top-0 right-0 h-full w-80 bg-gray-900/95 backdrop-blur-xl border-l border-white/10 shadow-2xl z-10 flex flex-col">
        <!-- 头部信息 -->
        <div class="p-6 border-b border-white/10">
          <h1 class="text-2xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
            Face Mesh
          </h1>
          <div class="flex items-center gap-2 text-xs font-mono">
            <span class="px-2 py-1 rounded bg-white/10 text-gray-300">
              {{ rendererType }}
            </span>
            <span class="px-2 py-1 rounded bg-green-500/20 text-green-400 border border-green-500/30">
              {{ fps }} FPS
            </span>
          </div>
        </div>
        
        <!-- 可滚动内容区域 -->
        <div class="flex-1 overflow-y-auto p-6 space-y-8">
          <!-- 状态与调试信息 -->
          <div class="p-4 rounded-xl bg-white/5 border border-white/5 space-y-2">
            <div class="flex justify-between text-xs">
              <span class="text-gray-400">人脸检测</span>
              <span :class="isFaceDetected ? 'text-green-400' : 'text-red-400'">{{ isFaceDetected ? '已锁定' : '搜索中...' }}</span>
            </div>
            <div class="flex justify-between text-xs">
              <span class="text-gray-400">3D 网格数据</span>
              <span :class="hasGeometry ? 'text-green-400' : 'text-yellow-400'">{{ hasGeometry ? '已加载' : '等待中' }}</span>
            </div>
          </div>

          <!-- 显示模式切换 -->
          <div class="space-y-3">
            <label class="text-xs font-bold text-gray-400 uppercase tracking-wider">
              显示模式
            </label>
            <div class="grid grid-cols-2 gap-3">
              <button 
                @click="viewMode = 'camera'"
                class="flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-200"
                :class="viewMode === 'camera' ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10'"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mb-2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                <span class="text-xs font-medium">AR 视图</span>
              </button>
              <button 
                @click="viewMode = 'model'"
                class="flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-200"
                :class="viewMode === 'model' ? 'bg-purple-600/20 border-purple-500 text-purple-400' : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10'"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mb-2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                <span class="text-xs font-medium">3D 白模</span>
              </button>
            </div>
          </div>

          <!-- 模型显示选项 -->
          <div v-if="viewMode === 'model'" class="space-y-6 animate-fade-in">
            <div class="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
              <div class="flex items-center gap-3">
                <div class="p-2 rounded-lg bg-purple-500/20 text-purple-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line></svg>
                </div>
                <span class="text-sm font-medium text-gray-200">显示线框</span>
              </div>
              <button 
                @click="showWireframe = !showWireframe"
                class="w-12 h-6 rounded-full transition-colors duration-300 focus:outline-none relative"
                :class="showWireframe ? 'bg-purple-500' : 'bg-gray-700'"
              >
                <div 
                  class="absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-300 shadow-sm"
                  :class="showWireframe ? 'translate-x-6' : 'translate-x-0'"
                ></div>
              </button>
            </div>
          </div>

          <!-- 透明度调节 -->
          <div class="space-y-3">
            <div class="flex justify-between items-end">
              <label class="text-xs font-bold text-gray-400 uppercase tracking-wider">透明度</label>
              <span class="text-xs font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">{{ Math.round(opacity * 100) }}%</span>
            </div>
            <input 
              type="range" 
              v-model.number="opacity" 
              min="0" 
              max="1" 
              step="0.05" 
              class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500 hover:accent-purple-400 transition-all"
            >
          </div>

          <!-- 网格精度 -->
          <div class="space-y-3">
            <label class="text-xs font-bold text-gray-400 uppercase tracking-wider">
              网格精度
            </label>
            <div class="relative">
              <select 
                v-model="meshDensity" 
                class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white appearance-none focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all cursor-pointer hover:bg-white/10"
              >
                <option value="high" class="bg-gray-900">高精度 (468 顶点)</option>
                <option value="low" class="bg-gray-900">低精度 (性能优先)</option>
              </select>
              <div class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Footer -->
        <div class="p-6 border-t border-white/10 bg-black/20">
          <p class="text-[10px] text-gray-500 uppercase tracking-widest text-center font-medium">
            Powered by WebGPU & MediaPipe
          </p>
        </div>
      </div>
    </transition>

    <!-- Loading & Error Overlay -->
    <transition
      leave-active-class="transition ease-in duration-500"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="isLoading || errorMessage" class="absolute inset-0 flex flex-col items-center justify-center bg-[#0f172a] z-50">
        <div class="absolute inset-0 overflow-hidden pointer-events-none">
          <div class="absolute -top-24 -left-24 w-80 h-80 bg-purple-500/20 blur-3xl"></div>
          <div class="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-500/15 blur-[100px]"></div>
        </div>
        <div class="relative w-24 h-24 mb-8 drop-shadow-lg">
          <div class="absolute inset-0 rounded-full border-t-2 border-r-2 border-blue-500 animate-spin"></div>
          <div class="absolute inset-2 rounded-full border-t-2 border-l-2 border-purple-500 animate-spin-reverse"></div>
          <div class="absolute inset-0 flex items-center justify-center">
            <svg class="w-8 h-8" :class="errorMessage ? 'text-red-300/80' : 'text-white/40'" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6z"/></svg>
          </div>
        </div>
        <h2 class="text-2xl font-bold text-white mb-2 tracking-tight" v-if="!errorMessage">初始化引擎</h2>
        <h2 v-else class="text-2xl font-bold text-red-200 mb-2 tracking-tight">加载失败</h2>
        <p class="text-gray-300 text-sm" v-if="!errorMessage">正在请求摄像头权限并加载模型...</p>
        <p class="text-red-200 text-sm text-center max-w-md leading-relaxed" v-else>{{ errorMessage }}</p>
        <button
          v-if="errorMessage"
          class="mt-4 px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white hover:bg-white/20 transition"
          @click="retryInit"
        >
          重试
        </button>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import * as THREE from 'three'
import { WebGPURenderer } from 'three/webgpu'

const videoRef = ref(null)
const canvasContainer = ref(null)
const isLoading = ref(true)
const viewMode = ref('camera')
const showWireframe = ref(true)
const opacity = ref(0.5)
const meshDensity = ref('high')
const fps = ref(0)
const rendererType = ref('检测中...')
const controlsVisible = ref(true) // 控制面板显示状态
const isFaceDetected = ref(false)
const hasGeometry = ref(false)
const errorMessage = ref('')

let camera = null
let faceMesh = null
let scene, threeCamera, renderer
let faceGeometry, faceMaterial, faceMeshObject
let pointCloud, pointsGeometry, pointsMaterial
let lastTime = 0
let frameCount = 0
let normalsFrame = 0
let loadingTimer = null
let animationLoopAttached = false
const FACE_MESH_VERSION = '0.4.1633559619'

// 三角剖分索引会在启用几何数据后由 MediaPipe 返回
let triangulationIndices = null

const isMobile = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer:coarse)').matches

const resetState = () => {
  isFaceDetected.value = false
  hasGeometry.value = false
  triangulationIndices = null
  normalsFrame = 0
}

const disposeResources = () => {
  if (renderer) {
    renderer.setAnimationLoop(null)
    animationLoopAttached = false
    renderer.dispose()
    if (renderer.domElement?.parentElement) {
      renderer.domElement.parentElement.removeChild(renderer.domElement)
    }
  }
  pointsGeometry?.dispose()
  faceGeometry?.dispose()
  pointsMaterial?.dispose()
  faceMaterial?.dispose()
  pointCloud = null
  faceMeshObject = null
  scene = null
  renderer = null
  threeCamera = null
}

// 主动触发浏览器的摄像头权限弹窗，降低首次失败的概率
const requestCameraPermission = async () => {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true })
    stream.getTracks().forEach(track => track.stop())
  } catch (e) {
    console.warn('预请求摄像头权限失败', e)
  }
}

const stopMedia = async () => {
  if (camera) {
    try {
      await camera.stop()
    } catch (e) {
      console.warn('停止摄像头失败', e)
    }
    camera = null
  }
  if (faceMesh?.close) {
    try {
      await faceMesh.close()
    } catch (e) {
      console.warn('关闭 FaceMesh 失败', e)
    }
  }
  faceMesh = null
}

const createRenderer = async (width, height) => {
  if (typeof navigator !== 'undefined' && navigator.gpu) {
    try {
      const webgpuRenderer = new WebGPURenderer({ antialias: true, alpha: true })
      await webgpuRenderer.init()
      webgpuRenderer.setSize(width, height)
      webgpuRenderer.setPixelRatio(window.devicePixelRatio)
      rendererType.value = 'WebGPU'
      return webgpuRenderer
    } catch (e) {
      console.warn('WebGPU 初始化失败，回退到 WebGL', e)
      try { renderer?.dispose() } catch (_) {}
    }
  }

  const webglRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  webglRenderer.setSize(width, height)
  webglRenderer.setPixelRatio(window.devicePixelRatio)
  rendererType.value = 'WebGL'
  return webglRenderer
}

const initThreeJS = async () => {
  const width = window.innerWidth
  const height = window.innerHeight

  scene = new THREE.Scene()
  
  // 相机设置
  threeCamera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000)
  threeCamera.position.z = 2 // 离脸更近一些

  renderer = await createRenderer(width, height)
  if (!renderer) {
    throw new Error('渲染器初始化失败')
  }
  canvasContainer.value.appendChild(renderer.domElement)

  // 灯光
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
  scene.add(ambientLight)
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
  directionalLight.position.set(0, 1, 1)
  scene.add(directionalLight)

  // 初始化几何体；低精度模式减少点数以提升性能
  const maxPoints = meshDensity.value === 'low' ? 156 : 468
  const positions = new Float32Array(maxPoints * 3)
  
  // 1. 点云 (矩阵视图)
  pointsGeometry = new THREE.BufferGeometry()
  pointsGeometry.setAttribute('position', new THREE.BufferAttribute(positions.slice(), 3))
  
  pointsMaterial = new THREE.PointsMaterial({
    color: 0x6ee7ff,
    size: isMobile ? 0.045 : 0.028,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.9
  })
  
  pointCloud = new THREE.Points(pointsGeometry, pointsMaterial)
  scene.add(pointCloud)

  // 2. 面部网格 (白模)
  faceGeometry = new THREE.BufferGeometry()
  faceGeometry.setAttribute('position', new THREE.BufferAttribute(positions.slice(), 3))
  
  faceMaterial = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    wireframe: true,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.5,
    flatShading: true
  })
  
  faceMeshObject = new THREE.Mesh(faceGeometry, faceMaterial)
  scene.add(faceMeshObject)
  
  updateVisibility()
  
  // 动画循环
  const loop = () => {
    renderer.render(scene, threeCamera)
    
    // FPS 计数器
    const now = performance.now()
    frameCount++
    if (now - lastTime >= 1000) {
      fps.value = frameCount
      frameCount = 0
      lastTime = now
    }
  }

  renderer.setAnimationLoop(loop)
  animationLoopAttached = true
}

const updateVisibility = () => {
  if (!pointCloud || !faceMeshObject) return

  if (viewMode.value === 'camera') {
    pointCloud.visible = true
    faceMeshObject.visible = false
    if (videoRef.value) videoRef.value.style.display = 'block'
    // 摄像头覆盖层的透明背景
    // WebGPURenderer 处理 alpha 的方式不同，但在构造函数中设置 alpha:true 有所帮助
  } else {
    const useMesh = meshDensity.value === 'high'
    pointCloud.visible = !useMesh
    faceMeshObject.visible = useMesh
    if (pointsMaterial) {
      pointsMaterial.size = useMesh ? (isMobile ? 0.045 : 0.028) : (isMobile ? 0.06 : 0.04)
      pointsMaterial.needsUpdate = true
    }
    faceMaterial.wireframe = showWireframe.value
    faceMaterial.opacity = opacity.value
    if (videoRef.value) videoRef.value.style.display = 'none'
  }
}

watch([viewMode, showWireframe, opacity, meshDensity], updateVisibility)

const onResults = (results) => {
  isLoading.value = false
  errorMessage.value = ''
  if (loadingTimer) clearTimeout(loadingTimer)
  
  if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
    isFaceDetected.value = true
    const landmarks = results.multiFaceLandmarks[0]
    
    // 如果未设置，获取三角剖分索引（依赖 enableFaceGeometry）
     if (!triangulationIndices && results.multiFaceGeometry && results.multiFaceGeometry.length > 0) {
       try {
         const faceGeo = results.multiFaceGeometry[0]
         const mesh = faceGeo.getMesh()
         const indices = mesh.getIndexBufferList()
         triangulationIndices = indices
         faceGeometry.setIndex(new THREE.BufferAttribute(indices, 1))
         hasGeometry.value = true
       } catch (e) {
         console.warn("无法从 API 提取索引", e)
       }
     } else if (triangulationIndices) {
       hasGeometry.value = true
     }

    // 更新几何体位置
    const positions = pointCloud.geometry.attributes.position.array
    const meshPositions = faceMeshObject.geometry.attributes.position.array
    
    // 计算视频在屏幕上的实际渲染尺寸，用于 object-cover 镜像换算
    const video = videoRef.value
    if (!video || video.videoWidth === 0) return

    const videoW = video.videoWidth
    const videoH = video.videoHeight
    const screenW = window.innerWidth
    const screenH = window.innerHeight

    const videoAspect = videoW / videoH
    const screenAspect = screenW / screenH

    let renderW, renderH
    // 计算 object-cover 下的渲染尺寸
    if (screenAspect > videoAspect) {
      renderW = screenW
      renderH = screenW / videoAspect
    } else {
      renderH = screenH
      renderW = screenH * videoAspect
    }

    // Three.js 视口计算
    const fov = threeCamera.fov * (Math.PI / 180)
    const distance = threeCamera.position.z
    const visibleHeight = 2 * Math.tan(fov / 2) * distance
    // 像素到世界单位的转换比例
    const pxToWorld = visibleHeight / screenH
    // 低精度模式下对 468 点做抽样以降低开销
    const targetPoints = meshDensity.value === 'low' ? 156 : landmarks.length
    const step = Math.ceil(landmarks.length / targetPoints)
    let writeIndex = 0

    for (let i = 0; i < landmarks.length && writeIndex < targetPoints; i += step) {
      const landmark = landmarks[i]

      // 像素坐标（相对视频中心）
      const dx = (landmark.x - 0.5) * renderW
      const dy = (landmark.y - 0.5) * renderH
      
      // 转换为 Three.js 世界坐标
      const x = -dx * pxToWorld // X 轴反转匹配镜像
      const y = -dy * pxToWorld // Y 轴反转使坐标朝上
      const z = -landmark.z * renderW * pxToWorld // Z 按视频宽度缩放
      
      const base = writeIndex * 3
      positions[base] = x
      positions[base + 1] = y
      positions[base + 2] = z
      
      if (writeIndex < meshPositions.length / 3) {
        meshPositions[base] = x
        meshPositions[base + 1] = y
        meshPositions[base + 2] = z
      }

      writeIndex++
    }
    
    pointCloud.geometry.attributes.position.needsUpdate = true
    faceMeshObject.geometry.attributes.position.needsUpdate = true

    // 仅在需要时重算法线，降低 CPU 开销
    const shouldRecomputeNormals = faceMeshObject.visible && triangulationIndices && (normalsFrame++ % 6 === 0)
    if (shouldRecomputeNormals) {
      faceMeshObject.geometry.computeVertexNormals()
    }
  } else {
    isFaceDetected.value = false
  }
}

const loadMediapipe = async () => {
  if (window.FaceMesh && window.Camera) {
    return { FaceMesh: window.FaceMesh, Camera: window.Camera }
  }
  try {
    const [{ FaceMesh }, { Camera }] = await Promise.all([
      import('@mediapipe/face_mesh'),
      import('@mediapipe/camera_utils')
    ])
    return { FaceMesh, Camera }
  } catch (e) {
    console.error('加载 Mediapipe 失败', e)
    throw new Error('无法加载 Mediapipe，检查网络或依赖安装。')
  }
}

const startPipeline = async () => {
  resetState()
  errorMessage.value = ''
  isLoading.value = true
  window.removeEventListener('resize', onResize)

  // 预请求摄像头权限，减少首次启动被浏览器拦截的概率
  await requestCameraPermission()

  if (loadingTimer) clearTimeout(loadingTimer)
  loadingTimer = setTimeout(() => {
    if (isLoading.value) {
      errorMessage.value = '初始化超时，请检查摄像头权限或网络。'
      isLoading.value = false
    }
  }, 12000)

  try {
    await initThreeJS()
  } catch (e) {
    console.error('ThreeJS 初始化失败', e)
    errorMessage.value = '渲染器初始化失败，可能不支持 WebGPU/WebGL。'
    isLoading.value = false
    if (loadingTimer) clearTimeout(loadingTimer)
    return
  }

  let FaceMeshCtor, CameraCtor
  try {
    const mp = await loadMediapipe()
    FaceMeshCtor = mp.FaceMesh
    CameraCtor = mp.Camera
  } catch (e) {
    errorMessage.value = e.message
    isLoading.value = false
    if (loadingTimer) clearTimeout(loadingTimer)
    return
  }

  const faceMeshScript = Array.from(document.scripts).find(s => s.src.includes('face_mesh.js'));
  const cdnBase = `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@${FACE_MESH_VERSION}/`
  const localBase = `${window.location.origin}/mediapipe/face_mesh/`
  let resourceBase = navigator.onLine ? cdnBase : localBase

  if (faceMeshScript) {
    const scriptUrl = faceMeshScript.src;
    if (!scriptUrl.includes('jsdelivr')) {
      resourceBase = scriptUrl.substring(0, scriptUrl.lastIndexOf('/') + 1);
    } else {
      resourceBase = scriptUrl.substring(0, scriptUrl.lastIndexOf('/') + 1);
    }
  }

  faceMesh = new FaceMeshCtor({ locateFile: (file) => `${resourceBase}${file}` })
  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
    enableFaceGeometry: true
  })
  faceMesh.onResults(onResults)

  if (!videoRef.value) {
    errorMessage.value = '未找到视频元素。'
    isLoading.value = false
    if (loadingTimer) clearTimeout(loadingTimer)
    return
  }

  const resolution = meshDensity.value === 'low' ? { width: 960, height: 540 } : { width: 1280, height: 720 }
  camera = new CameraCtor(videoRef.value, {
    onFrame: async () => {
      await faceMesh.send({ image: videoRef.value })
    },
    width: resolution.width,
    height: resolution.height
  })

  try {
    await camera.start()
    isLoading.value = false
    if (loadingTimer) clearTimeout(loadingTimer)
  } catch (e) {
    console.error('摄像头启动失败', e)
    errorMessage.value = '无法访问摄像头，请检查权限或设备。'
    isLoading.value = false
    if (loadingTimer) clearTimeout(loadingTimer)
  }

  window.addEventListener('resize', onResize)
}

const retryInit = async () => {
  await stopMedia()
  disposeResources()
  await startPipeline()
}

onMounted(async () => {
  await startPipeline()
})

watch(meshDensity, async (next, prev) => {
  if (next === prev) return
  if (isLoading.value) return
  await retryInit()
})

const onResize = () => {
  if (!threeCamera || !renderer) return
  const width = window.innerWidth
  const height = window.innerHeight
  threeCamera.aspect = width / height
  threeCamera.updateProjectionMatrix()
  renderer.setSize(width, height)
}

onBeforeUnmount(() => {
  if (animationLoopAttached && renderer) {
    renderer.setAnimationLoop(null)
  }
  stopMedia()
  disposeResources()
  window.removeEventListener('resize', onResize)
  if (loadingTimer) clearTimeout(loadingTimer)
})
</script>

<style scoped>
.animate-spin-reverse {
  animation: spin-reverse 1.5s linear infinite;
}

@keyframes spin-reverse {
  from {
    transform: rotate(360deg);
  }
  to {
    transform: rotate(0deg);
  }
}

.animate-fade-in {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>