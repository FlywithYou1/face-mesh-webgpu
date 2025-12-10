<template>
  <div class="relative w-full h-screen overflow-hidden bg-[#0f172a] font-sans text-white selection:bg-purple-500/30">
    <!-- Video Element (Hidden or Visible based on mode) -->
    <video
      ref="videoRef"
      class="absolute top-0 left-0 w-full h-full object-cover transform -scale-x-100 transition-opacity duration-500"
      playsinline
      style="display: none;"
    ></video>

    <!-- Canvas for Three.js -->
    <div ref="canvasContainer" class="absolute top-0 left-0 w-full h-full block pointer-events-none"></div>

    <!-- Toggle Controls Button (Mobile/Clean View) -->
    <button 
      @click="controlsVisible = !controlsVisible"
      class="absolute top-6 right-6 z-20 p-3 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white hover:bg-white/20 transition-all duration-300 shadow-lg"
    >
      <svg v-if="!controlsVisible" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
      <svg v-else xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
    </button>

    <!-- Sidebar Control Panel -->
    <transition
      enter-active-class="transition ease-out duration-300"
      enter-from-class="translate-x-full"
      enter-to-class="translate-x-0"
      leave-active-class="transition ease-in duration-200"
      leave-from-class="translate-x-0"
      leave-to-class="translate-x-full"
    >
      <div v-if="controlsVisible" class="absolute top-0 right-0 h-full w-80 bg-gray-900/95 backdrop-blur-xl border-l border-white/10 shadow-2xl z-10 flex flex-col">
        <!-- Header -->
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
        
        <!-- Scrollable Content -->
        <div class="flex-1 overflow-y-auto p-6 space-y-8">
          <!-- Status & Debug -->
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

          <!-- View Mode -->
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

          <!-- Model Options -->
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

          <!-- Opacity Slider -->
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

          <!-- Mesh Density -->
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

    <!-- Loading Overlay -->
    <transition
      leave-active-class="transition ease-in duration-500"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="isLoading" class="absolute inset-0 flex flex-col items-center justify-center bg-[#0f172a] z-50">
        <div class="relative w-24 h-24 mb-8">
          <div class="absolute inset-0 rounded-full border-t-2 border-r-2 border-blue-500 animate-spin"></div>
          <div class="absolute inset-2 rounded-full border-t-2 border-l-2 border-purple-500 animate-spin-reverse"></div>
          <div class="absolute inset-0 flex items-center justify-center">
            <svg class="w-8 h-8 text-white/20" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6z"/></svg>
          </div>
        </div>
        <h2 class="text-2xl font-bold text-white mb-2 tracking-tight">初始化引擎</h2>
        <p class="text-gray-400 text-sm animate-pulse">正在加载 AI 模型与 WebGPU 上下文...</p>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
// MediaPipe is loaded via CDN in index.html to avoid bundler issues
// const FaceMesh = window.FaceMesh
// const Camera = window.Camera
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
const controlsVisible = ref(true) // New state for toggling UI
const isFaceDetected = ref(false)
const hasGeometry = ref(false)

let camera = null
let faceMesh = null
let scene, threeCamera, renderer
let faceGeometry, faceMaterial, faceMeshObject
let pointCloud, pointsGeometry
let lastTime = 0
let frameCount = 0

// 三角剖分索引将从 MediaPipe 加载
let triangulationIndices = null

const initThreeJS = async () => {
  const width = window.innerWidth
  const height = window.innerHeight

  scene = new THREE.Scene()
  
  // 相机设置
  threeCamera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000)
  threeCamera.position.z = 2 // 离脸更近一些

  // 渲染器设置 - 优先尝试 WebGPU
  try {
    renderer = new WebGPURenderer({ antialias: true, alpha: true })
    rendererType.value = 'WebGPU'
  } catch (e) {
    console.warn('不支持 WebGPU，回退到 WebGL', e)
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    rendererType.value = 'WebGL'
  }
  
  renderer.setSize(width, height)
  renderer.setPixelRatio(window.devicePixelRatio)
  canvasContainer.value.appendChild(renderer.domElement)

  // 灯光
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
  scene.add(ambientLight)
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
  directionalLight.position.set(0, 1, 1)
  scene.add(directionalLight)

  // 初始化几何体
  const maxPoints = 468
  const positions = new Float32Array(maxPoints * 3)
  
  // 1. 点云 (矩阵视图)
  pointsGeometry = new THREE.BufferGeometry()
  pointsGeometry.setAttribute('position', new THREE.BufferAttribute(positions.slice(), 3))
  
  const pointsMaterial = new THREE.PointsMaterial({
    color: 0x00ff00,
    size: 0.02,
    sizeAttenuation: true
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
  renderer.setAnimationLoop(() => {
    renderer.render(scene, threeCamera)
    
    // FPS 计数器
    const now = performance.now()
    frameCount++
    if (now - lastTime >= 1000) {
      fps.value = frameCount
      frameCount = 0
      lastTime = now
    }
  })
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
    pointCloud.visible = false
    faceMeshObject.visible = true
    faceMaterial.wireframe = showWireframe.value
    faceMaterial.opacity = opacity.value
    if (videoRef.value) videoRef.value.style.display = 'none'
  }
}

watch([viewMode, showWireframe, opacity], updateVisibility)

const onResults = (results) => {
  isLoading.value = false
  
  if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
    isFaceDetected.value = true
    const landmarks = results.multiFaceLandmarks[0]
    
    // 如果未设置，获取三角剖分索引
    // 注意：需要在 setOptions 中设置 enableFaceGeometry: true
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
    
    // 获取视频和屏幕尺寸以处理 object-cover 和镜像
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

    landmarks.forEach((landmark, index) => {
      // 1. 计算相对于视频中心的像素坐标
      // MediaPipe x,y 是 0-1 归一化的
      const dx = (landmark.x - 0.5) * renderW
      const dy = (landmark.y - 0.5) * renderH
      
      // 2. 转换为 Three.js 世界坐标
      // X 轴取反：因为视频被 CSS 镜像翻转了 (-scale-x-100)，
      // 原本在左边(x<0.5, dx<0)的点现在显示在右边，所以世界坐标 x 应该为正。
      // -dx 正好满足这个需求。
      const x = -dx * pxToWorld
      
      // Y 轴取反：MediaPipe y 向下，Three.js y 向上
      const y = -dy * pxToWorld
      
      // Z 轴：MediaPipe z 是按图像宽度归一化的
      // 我们也按渲染宽度将其转换为世界单位
      // 适当调整 Z 深度因子以获得更好的 3D 感
      const z = -landmark.z * renderW * pxToWorld
      
      // 更新点云
      positions[index * 3] = x
      positions[index * 3 + 1] = y
      positions[index * 3 + 2] = z
      
      // 更新网格
      meshPositions[index * 3] = x
      meshPositions[index * 3 + 1] = y
      meshPositions[index * 3 + 2] = z
    })
    
    pointCloud.geometry.attributes.position.needsUpdate = true
    faceMeshObject.geometry.attributes.position.needsUpdate = true
    faceMeshObject.geometry.computeVertexNormals()
  } else {
    isFaceDetected.value = false
  }
}

onMounted(async () => {
  await initThreeJS()
  
  // 动态确定资源路径：优先使用当前脚本加载路径，如果检测到是 jsdelivr (已知有问题) 则强制回退到 unpkg
  const faceMeshScript = Array.from(document.scripts).find(s => s.src.includes('face_mesh.js'));
  let resourceBase = 'https://unpkg.com/@mediapipe/face_mesh/'; // 默认使用 unpkg 作为更稳定的源
  
  if (faceMeshScript) {
    const scriptUrl = faceMeshScript.src;
    // 如果当前脚本不是 jsdelivr，或者我们想强制避开 jsdelivr 的 data 文件问题
    if (!scriptUrl.includes('jsdelivr')) {
      resourceBase = scriptUrl.substring(0, scriptUrl.lastIndexOf('/') + 1);
    }
  }

  faceMesh = new window.FaceMesh({locateFile: (file) => {
    return `${resourceBase}${file}`;
  }});
  
  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: false, // Set to false to avoid crash with enableFaceGeometry (478 vs 468 landmarks mismatch)
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
    enableFaceGeometry: true // 请求几何数据
  });
  
  faceMesh.onResults(onResults);
  
  if (videoRef.value) {
    camera = new window.Camera(videoRef.value, {
      onFrame: async () => {
        await faceMesh.send({image: videoRef.value});
      },
      width: 1280,
      height: 720
    });
    camera.start();
  }
  
  window.addEventListener('resize', onResize)
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
  if (camera) camera.stop()
  window.removeEventListener('resize', onResize)
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