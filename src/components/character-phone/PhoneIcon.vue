<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{ name: string }>()
const paths: Record<string, string> = {
  chat: 'M21 11a8 8 0 0 1-8 8H7l-5 3 2-6a8 8 0 1 1 17-5Z M8 10h8 M8 14h5',
  sms: 'M3 5h18v14H3z M3 6l9 7 9-7',
  contacts: 'M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M4 21v-2a8 8 0 0 1 16 0v2',
  calls: 'M7 3H3c-1 10 8 19 18 18v-4l-5-2-2 2a15 15 0 0 1-7-7l2-2-2-5Z',
  photos: 'M3 3h18v18H3z M3 17l6-6 5 5 3-3 4 4 M15 7h.01',
  files: 'M5 2h9l5 5v15H5z M14 2v6h5 M8 13h8 M8 17h5',
  notes: 'M5 3h14v18H5z M8 7h8 M8 11h8 M8 15h5',
  calendar: 'M3 5h18v16H3z M7 2v6 M17 2v6 M3 10h18 M7 14h2 M13 14h2 M7 18h2',
  browser: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M3 12h18 M12 3c-5 5-5 13 0 18 M12 3c5 5 5 13 0 18',
  maps: 'M12 22s8-9 8-14A8 8 0 0 0 4 8c0 5 8 14 8 14Z M15 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M12 6v6l4 3',
  settings: 'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1 1-3Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  moments: 'M12 3v6l5-4 M21 12h-6l4 5 M12 21v-6l-5 4 M3 12h6L5 7 M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  device: 'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2 M10 5h4 M11 19h2',
  back: 'M15 5l-7 7 7 7', close: 'M6 6l12 12 M6 18 18 6', plus: 'M12 4v16 M4 12h16',
  search: 'M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0 M15 15l6 6',
  more: 'M5 12h.01 M12 12h.01 M19 12h.01',
  lock: 'M5 10h14v11H5z M8 10V6a4 4 0 0 1 8 0v4 M12 14v3',
  bell: 'M5 17V9a7 7 0 0 1 14 0v8l2 2H3l2-2 M10 22h4',
  home: 'M3 11l9-8 9 8 M5 10v11h14V10 M9 21v-7h6v7',
  check: 'M4 12l5 5L20 6', edit: 'M4 16 16 4l4 4L8 20H4v-4 M14 6l4 4',
  share: 'M12 16V2 M7 7l5-5 5 5 M5 12H3v10h18V12h-2',
}
const path = computed(() => paths[props.name] || paths.notes)
</script>
<template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="path" /></svg></template>
