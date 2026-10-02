<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import PaymentPasswordModal from '../chat/modals/PaymentPasswordModal.vue'
import { useChatAuth } from '../../composables/useChatAuth'
import { walletAuthorizationEventName, type WalletAuthorizationRequest } from '../../services/walletService'

const props = defineProps<{ contextKey?: string | null }>()
const request = ref<WalletAuthorizationRequest | null>(null)
const { currentChatUserId, chatAccounts } = useChatAuth()
const finish = (credential: string | null) => {
  const current = request.value
  request.value = null
  current?.finish(credential)
}
const receive = (event: Event) => {
  const incoming = (event as CustomEvent<WalletAuthorizationRequest>).detail
  incoming.accepted = true
  if (request.value) { incoming.finish(null); return }
  request.value = incoming
}
window.addEventListener(walletAuthorizationEventName, receive)
watch(() => props.contextKey, () => finish(null))
watch(currentChatUserId, () => finish(null))
watch(chatAccounts, () => {
  if (request.value && request.value.intent.accountId !== 'guest' && !chatAccounts.value.some(item => item.id === request.value?.intent.accountId)) finish(null)
}, { deep: true })
onBeforeUnmount(() => { window.removeEventListener(walletAuthorizationEventName, receive); finish(null) })
</script>

<template>
  <Teleport to="body">
    <PaymentPasswordModal v-if="request" :visible="true" :account-id="request.intent.accountId" :intent="request.intent" :theme="request.intent.theme" @close="finish(null)" @success="finish" />
  </Teleport>
</template>
