<template>
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
        @click="$emit('retry')"
      >
        重试
      </button>
    </div>
  </transition>
</template>

<script setup>
defineProps({
  isLoading: Boolean,
  errorMessage: String
})

defineEmits(['retry'])
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
</style>
