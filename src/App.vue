<template>
  <div class="relative w-full h-screen overflow-hidden bg-gray-900">
    <!-- Video Element (Hidden or Visible based on mode) -->
    <video
      ref="videoRef"
      class="absolute top-0 left-0 w-full h-full object-cover transform -scale-x-100"
      playsinline
      style="display: none;"
    ></video>

    <!-- Canvas for Three.js -->
    <div ref="canvasContainer" class="absolute top-0 left-0 w-full h-full block"></div>

    <!-- UI Controls -->
    <div class="absolute top-4 left-4 z-10 bg-black/50 p-4 rounded-lg backdrop-blur-sm text-white w-64">
      <h1 class="text-xl font-bold mb-4">WebGPU 人脸网格</h1>
      
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium mb-1">显示模式</label>
          <select v-model="viewMode" class="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1">
            <option value="camera">摄像头 + 矩阵</option>
            <option value="model">白模</option>
          </select>
        </div>

        <div v-if="viewMode === 'model'">
          <label class="block text-sm font-medium mb-1">线框</label>
          <input type="checkbox" v-model="showWireframe" class="mr-2">
        </div>

        <div>
          <label class="block text-sm font-medium mb-1">透明度</label>
          <input 
            type="range" 
            v-model.number="opacity" 
            min="0" 
            max="1" 
            step="0.1" 
            class="w-full"
          >
        </div>

        <div>
          <label class="block text-sm font-medium mb-1">网格密度 (精度)</label>
          <select v-model="meshDensity" class="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1">
            <option value="high">高 (468 点)</option>
            <option value="low">低 (简化)</option>
          </select>
        </div>
        
        <div class="text-xs text-gray-400 mt-2">
          FPS: {{ fps }} <br>
          渲染器: {{ rendererType }}
        </div>
      </div>
    </div>

    <!-- Loading Indicator -->
    <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center bg-black/80 z-50">
      <div class="text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
        <p>正在加载人脸网格...</p>
      </div>
    </div>
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
/* Add any component specific styles here */
</style>
