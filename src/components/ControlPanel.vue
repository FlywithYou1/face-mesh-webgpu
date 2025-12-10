<template>
  <div>
    <!-- 控制面板显示开关 -->
    <button 
      @click="visible = !visible"
      class="absolute top-6 right-6 z-20 p-3 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white hover:bg-white/20 transition-all duration-300 shadow-lg"
    >
      <svg v-if="!visible" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
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
      <div v-if="visible" class="absolute top-0 right-0 h-full w-80 bg-gray-900/95 backdrop-blur-xl border-l border-white/10 shadow-2xl z-10 flex flex-col">
        <!-- 头部信息 -->
        <div class="p-6 border-b border-white/10">
          <h1 class="text-2xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
            Face Mesh
          </h1>
          <div class="flex items-center gap-2 text-xs font-mono">
            <span
              class="px-2 py-1 rounded border"
              :class="rendererType === 'WebGPU' ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' : 'bg-amber-500/15 border-amber-500/40 text-amber-200'"
            >
              {{ rendererType === 'WebGPU' ? 'WebGPU (首选)' : 'WebGL (降级)' }}
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
                @click="$emit('update:viewMode', 'camera')"
                class="flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-200"
                :class="viewMode === 'camera' ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10'"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mb-2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                <span class="text-xs font-medium">AR 视图</span>
              </button>
              <button 
                @click="$emit('update:viewMode', 'model')"
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
                @click="$emit('update:showWireframe', !showWireframe)"
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
              :value="opacity"
              @input="$emit('update:opacity', parseFloat($event.target.value))"
              min="0" 
              max="1" 
              step="0.05" 
              class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500 hover:accent-purple-400 transition-all"
            >
          </div>

          <!-- 点大小调节 -->
          <div class="space-y-3">
            <div class="flex justify-between items-end">
              <label class="text-xs font-bold text-gray-400 uppercase tracking-wider">点大小</label>
              <span class="text-xs font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">{{ pointSize }}px</span>
            </div>
            <input 
              type="range" 
              :value="pointSize"
              @input="$emit('update:pointSize', parseFloat($event.target.value))"
              min="1" 
              max="10" 
              step="0.5" 
              class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500 hover:accent-purple-400 transition-all"
            >
          </div>

          <!-- 材质与光效 -->
          <div v-if="viewMode === 'model'" class="space-y-4 animate-fade-in">
            <div class="space-y-3">
              <label class="text-xs font-bold text-gray-400 uppercase tracking-wider">材质类型</label>
              <div class="grid grid-cols-4 gap-2">
                <button 
                  v-for="type in ['wireframe', 'hologram', 'solid', 'texture']" 
                  :key="type"
                  @click="$emit('update:materialType', type)"
                  class="px-2 py-2 rounded-lg text-[10px] font-medium uppercase tracking-wider border transition-all"
                  :class="materialType === type ? 'bg-purple-500/20 border-purple-500 text-purple-300' : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10'"
                >
                  {{ type === 'wireframe' ? '线框' : type === 'hologram' ? '全息' : type === 'solid' ? '实体' : '纹理' }}
                </button>
              </div>
            </div>

            <div v-if="materialType === 'texture'" class="space-y-3 animate-fade-in">
               <label class="text-xs font-bold text-gray-400 uppercase tracking-wider">上传纹理</label>
               <input 
                 type="file" 
                 accept="image/*"
                 @change="$emit('uploadTexture', $event.target.files[0])"
                 class="w-full text-xs text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-purple-500/20 file:text-purple-400 hover:file:bg-purple-500/30"
               />
            </div>

            <div v-if="materialType !== 'wireframe' && materialType !== 'texture'" class="space-y-3">
              <div class="flex justify-between items-end">
                <label class="text-xs font-bold text-gray-400 uppercase tracking-wider">发光强度</label>
                <span class="text-xs font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">{{ glowIntensity.toFixed(1) }}</span>
              </div>
              <input 
                type="range" 
                :value="glowIntensity"
                @input="$emit('update:glowIntensity', parseFloat($event.target.value))"
                min="0" 
                max="2" 
                step="0.1" 
                class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500 hover:accent-purple-400 transition-all"
              >
            </div>
          </div>

          <!-- AR 特效 -->
          <div class="space-y-3">
            <label class="text-xs font-bold text-gray-400 uppercase tracking-wider">AR 特效</label>
            <div class="grid grid-cols-2 gap-3">
               <button 
                @click="$emit('update:showParticles', !showParticles)"
                class="flex items-center justify-center p-3 rounded-xl border transition-all duration-200 gap-2"
                :class="showParticles ? 'bg-yellow-600/20 border-yellow-500 text-yellow-400' : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10'"
              >
                <span class="text-xs font-medium">✨ 粒子特效</span>
              </button>
              <button 
                @click="$emit('update:showHat', !showHat)"
                class="flex items-center justify-center p-3 rounded-xl border transition-all duration-200 gap-2"
                :class="showHat ? 'bg-red-600/20 border-red-500 text-red-400' : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10'"
              >
                <span class="text-xs font-medium">🎩 虚拟帽子</span>
              </button>
            </div>
          </div>

          <!-- 颜色设置 -->
          <div class="space-y-3">
            <label class="text-xs font-bold text-gray-400 uppercase tracking-wider">颜色设置</label>
            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-2">
                <span class="text-[10px] text-gray-400 block">点颜色</span>
                <div class="flex items-center gap-2 bg-white/5 p-2 rounded-lg border border-white/10">
                  <input 
                    type="color" 
                    :value="pointColor" 
                    @input="$emit('update:pointColor', $event.target.value)" 
                    class="h-6 w-8 rounded cursor-pointer bg-transparent border-none p-0" 
                  />
                  <span class="text-[10px] font-mono text-gray-300">{{ pointColor }}</span>
                </div>
              </div>
              <div class="space-y-2">
                <span class="text-[10px] text-gray-400 block">线框颜色</span>
                <div class="flex items-center gap-2 bg-white/5 p-2 rounded-lg border border-white/10">
                  <input 
                    type="color" 
                    :value="wireframeColor" 
                    @input="$emit('update:wireframeColor', $event.target.value)" 
                    class="h-6 w-8 rounded cursor-pointer bg-transparent border-none p-0" 
                  />
                  <span class="text-[10px] font-mono text-gray-300">{{ wireframeColor }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 截图与录制 -->
          <div class="pt-4 border-t border-white/10 space-y-3">
            <button 
              @click="$emit('capture')"
              class="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold shadow-lg shadow-purple-900/20 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
              <span>保存截图</span>
            </button>
            
            <button 
              @click="isRecording ? $emit('stopRecording') : $emit('startRecording')"
              class="w-full py-3 rounded-xl font-bold shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
              :class="isRecording ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse' : 'bg-white/10 hover:bg-white/20 text-gray-200'"
            >
              <svg v-if="!isRecording" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
              <span>{{ isRecording ? '停止录制' : '录制视频' }}</span>
            </button>
          </div>

          <!-- 网格精度 -->
          <div class="space-y-3">
            <label class="text-xs font-bold text-gray-400 uppercase tracking-wider">
              网格精度
            </label>
            <div class="relative">
              <select 
                :value="meshDensity"
                @change="$emit('update:meshDensity', $event.target.value)"
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

          <!-- 资源源 (CDN) -->
          <div class="space-y-3">
            <label class="text-xs font-bold text-gray-400 uppercase tracking-wider">模型源 (CDN)</label>
            <div class="relative">
              <select
                :value="cdnSource"
                @change="$emit('update:cdnSource', $event.target.value)"
                class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white appearance-none focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all cursor-pointer hover:bg-white/10"
              >
                <option value="auto" class="bg-gray-900">自动 (JSDelivr → Unpkg → 本地)</option>
                <option value="jsdelivr" class="bg-gray-900">JSDelivr</option>
                <option value="unpkg" class="bg-gray-900">Unpkg</option>
                <option value="local" class="bg-gray-900">本地 /mediapipe/face_mesh/</option>
              </select>
              <div class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              </div>
            </div>
            <p class="text-[11px] text-gray-500 leading-relaxed">
              如果加载失败，可切换源后点击重试。
            </p>
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
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  rendererType: String,
  fps: Number,
  isFaceDetected: Boolean,
  hasGeometry: Boolean,
  viewMode: String,
  showWireframe: Boolean,
  opacity: Number,
  meshDensity: String,
  pointSize: Number,
  pointColor: String,
  wireframeColor: String,
  materialType: String,
  glowIntensity: Number,
  cdnSource: String,
  showParticles: Boolean,
  showHat: Boolean,
  isRecording: Boolean
})

defineEmits([
  'update:viewMode',
  'update:showWireframe',
  'update:opacity',
  'update:meshDensity',
  'update:pointSize',
  'update:pointColor',
  'update:wireframeColor',
  'update:materialType',
  'update:glowIntensity',
  'update:cdnSource',
  'update:showParticles',
  'update:showHat',
  'capture',
  'uploadTexture',
  'startRecording',
  'stopRecording'
])

const visible = ref(true)
</script>

<style scoped>
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
