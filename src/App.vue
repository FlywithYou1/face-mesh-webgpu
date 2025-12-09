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
      class="absolute top-6 right-6 z-20 p-3 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white/80 hover:bg-white/10 hover:text-white transition-all duration-300"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      </svg>
    </button>

    <!-- Modern Glassmorphism Control Panel -->
    <transition
      enter-active-class="transition ease-out duration-300"
      enter-from-class="opacity-0 translate-x-10"
      enter-to-class="opacity-100 translate-x-0"
      leave-active-class="transition ease-in duration-200"
      leave-from-class="opacity-100 translate-x-0"
      leave-to-class="opacity-0 translate-x-10"
    >
      <div v-if="controlsVisible" class="absolute top-20 right-6 z-10 w-80 p-6 rounded-3xl bg-gray-900/60 backdrop-blur-xl border border-white/10 shadow-2xl">
        <div class="flex items-center justify-between mb-6">
          <h1 class="text-2xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Face Mesh
          </h1>
          <div class="flex items-center gap-2">
            <span class="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-[10px] font-mono text-gray-400">
              {{ rendererType }}
            </span>
            <span class="px-2 py-1 rounded-md bg-green-500/20 border border-green-500/30 text-[10px] font-mono text-green-400">
              {{ fps }} FPS
            </span>
          </div>
        </div>
        
        <div class="space-y-6">
          <!-- View Mode -->
          <div class="group">
            <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 block group-hover:text-blue-400 transition-colors">
              显示模式
            </label>
            <div class="grid grid-cols-2 gap-2 p-1 bg-black/20 rounded-xl border border-white/5">
              <button 
                @click="viewMode = 'camera'"
                class="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                :class="viewMode === 'camera' ? 'bg-white/10 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'"
              >
                AR 视图
              </button>
              <button 
                @click="viewMode = 'model'"
                class="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                :class="viewMode === 'model' ? 'bg-white/10 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'"
              >
                3D 白模
              </button>
            </div>
          </div>

          <!-- Model Options -->
          <div v-if="viewMode === 'model'" class="space-y-4 animate-fade-in">
            <div class="flex items-center justify-between">
              <label class="text-sm font-medium text-gray-300">显示线框</label>
              <button 
                @click="showWireframe = !showWireframe"
                class="w-12 h-6 rounded-full transition-colors duration-300 focus:outline-none relative"
                :class="showWireframe ? 'bg-purple-500/50' : 'bg-gray-700'"
              >
                <div 
                  class="absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-300 shadow-sm"
                  :class="showWireframe ? 'translate-x-6' : 'translate-x-0'"
                ></div>
              </button>
            </div>
          </div>

          <!-- Opacity Slider -->
          <div>
            <div class="flex justify-between mb-2">
              <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">透明度</label>
              <span class="text-xs font-mono text-gray-500">{{ Math.round(opacity * 100) }}%</span>
            </div>
            <input 
              type="range" 
              v-model.number="opacity" 
              min="0" 
              max="1" 
              step="0.05" 
              class="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500 hover:accent-purple-400 transition-all"
            >
          </div>

          <!-- Mesh Density -->
          <div>
            <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 block">
              网格精度
            </label>
            <div class="relative">
              <select 
                v-model="meshDensity" 
                class="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white appearance-none focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all cursor-pointer hover:bg-black/30"
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
        <div class="mt-8 pt-6 border-t border-white/5 text-center">
          <p class="text-[10px] text-gray-600 uppercase tracking-widest">Powered by WebGPU & MediaPipe</p>
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
       } catch (e) {
          console.warn("无法从 API 提取索引", e)
       }
    }

    // 更新几何体位置
    const positions = pointCloud.geometry.attributes.position.array
    const meshPositions = faceMeshObject.geometry.attributes.position.array
    
    // 映射：MediaPipe (0,0 左上) -> Three.js (0,0 中心)
    // 我们需要将 3D 网格与视频源对齐。
    // 在没有精确相机内参的情况下，这很棘手。
    // 我们将使用启发式缩放。
    
    const aspect = window.innerWidth / window.innerHeight
    const fov = threeCamera.fov * (Math.PI / 180)
    const heightAtZ = 2 * threeCamera.position.z * Math.tan(fov / 2)
    const widthAtZ = heightAtZ * aspect
    
    // 匹配视频源的缩放因子
    const scaleX = widthAtZ 
    const scaleY = heightAtZ 

    landmarks.forEach((landmark, index) => {
      // MediaPipe: x [0, 1], y [0, 1], z (按宽度缩放)
      // Three.js: x [-w/2, w/2], y [h/2, -h/2]
      
      const x = (0.5 - landmark.x) * scaleX
      const y = (0.5 - landmark.y) * scaleY
      // Z 需要类似地缩放。MediaPipe Z 大致相对于头部宽度为 -1 到 1
      const z = -landmark.z * scaleX // 启发式
      
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
  }
}

onMounted(async () => {
  await initThreeJS()
  
  faceMesh = new window.FaceMesh({locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
  }});
  
  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
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