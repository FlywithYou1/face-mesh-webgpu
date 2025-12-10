<template>
  <div class="relative w-full h-screen overflow-hidden bg-[#0f172a] font-sans text-white selection:bg-purple-500/30">
    <!-- 视频流 -->
    <video
      ref="videoRef"
      class="absolute top-0 left-0 w-full h-full object-cover transform -scale-x-100 transition-opacity duration-500"
      playsinline
      style="display: none;"
    ></video>

    <!-- Three.js 画布容器 -->
    <div ref="canvasContainer" class="absolute top-0 left-0 w-full h-full block pointer-events-none"></div>

    <!-- 控制面板 -->
    <ControlPanel
      :rendererType="rendererType"
      :fps="fps"
      :isFaceDetected="isFaceDetected"
      :hasGeometry="hasGeometry"
      v-model:viewMode="viewMode"
      v-model:showWireframe="showWireframe"
      v-model:opacity="opacity"
      v-model:meshDensity="meshDensity"
      v-model:pointSize="pointSize"
      v-model:pointColor="pointColor"
      v-model:wireframeColor="wireframeColor"
      v-model:materialType="materialType"
      v-model:glowIntensity="glowIntensity"
      v-model:cdnSource="cdnSource"
      v-model:showParticles="showParticles"
      v-model:showHat="showHat"
      :isRecording="isRecording"
      @capture="captureScreenshot"
      @uploadTexture="loadTexture"
      @startRecording="startRecording"
      @stopRecording="stopRecording"
    />

    <!-- 加载与错误提示 -->
    <LoadingOverlay
      :isLoading="isLoading"
      :errorMessage="errorMessage"
      @retry="retry"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useFaceMesh } from './composables/useFaceMesh'
import ControlPanel from './components/ControlPanel.vue'
import LoadingOverlay from './components/LoadingOverlay.vue'

const videoRef = ref(null)
const canvasContainer = ref(null)

const {
  isLoading,
  errorMessage,
  isFaceDetected,
  hasGeometry,
  rendererType,
  fps,
  viewMode,
  showWireframe,
  opacity,
  meshDensity,
  pointSize,
  pointColor,
  wireframeColor,
  materialType,
  glowIntensity,
  cdnSource,
  showParticles,
  showHat,
  isRecording,
  start,
  retry,
  captureScreenshot,
  loadTexture,
  startRecording,
  stopRecording
} = useFaceMesh(videoRef, canvasContainer)

onMounted(() => {
  start()
})

// 切换 CDN 时自动重试加载
watch(cdnSource, () => {
  retry()
})
</script>
