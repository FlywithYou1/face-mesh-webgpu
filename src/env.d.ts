/// <reference types="vite/client" />

import type { DefineComponent } from 'vue'

declare module '*.vue' {
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '*.wasm?url' {
  const src: string
  export default src
}

declare module '*.data?url' {
  const src: string
  export default src
}

declare module '*.binarypb?url' {
  const src: string
  export default src
}

declare module '*.js?url' {
  const src: string
  export default src
}
