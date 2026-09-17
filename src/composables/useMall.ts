/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
import { computed, reactive, ref } from 'vue'
import { useChatAuth } from './useChatAuth'
import { mockChats } from './chatState/state'
import {
  addMallCartItem,
  addMallEvent,
  addMallProduct,
  cancelMallOrder,
  checkoutStoryCart,
  createMallSnapshot,
  effectiveMallChatPermissions,
  loadMallSnapshot,
  mallCartItems,
  mallCartTotal,
  recordExternalProduct,
  removeMallProduct,
  saveMallSnapshot,
  setMallCartQuantity,
  toggleMallWishlist,
  viewMallProduct,
  advanceMallOrder
} from '../services/mallService'
import type { MallCartOwner, MallProduct, MallSnapshot } from '../types/mall'

const state = reactive<MallSnapshot>(createMallSnapshot('guest'))
const ready = ref(false)
let loadedAccountId = ''

const assign = (snapshot: MallSnapshot) => {
  Object.assign(state, snapshot)
}

export function useMall() {
  const { currentChatUserId, currentAccount } = useChatAuth()
  const accountId = computed(() => currentChatUserId.value || 'guest')

  const ensureLoaded = () => {
    if (!ready.value || loadedAccountId !== accountId.value) {
      loadedAccountId = accountId.value
      assign(loadMallSnapshot(accountId.value))
      ready.value = true
    }
  }

  const persist = () => saveMallSnapshot(state)
  const characters = computed(() => mockChats.value.filter(item => item.id !== 1 && item.chatType !== 'group' && !item.isCreate && item.contactState !== 'candidate'))
  const productMap = computed(() => new Map(state.products.map(product => [product.id, product])))
  const ownerCart = (owner: MallCartOwner) => mallCartItems(state, owner)
  const ownerTotal = (owner: MallCartOwner) => mallCartTotal(state, owner)
  const isWished = (productId: string, owner: MallCartOwner) => state.wishlist.some(item => item.productId === productId && item.owner === owner)
  const ownerWishlist = (owner: MallCartOwner) => state.wishlist.filter(item => item.owner === owner).map(item => productMap.value.get(item.productId)).filter(Boolean) as MallProduct[]

  return {
    state, ready, accountId, currentAccount, characters, productMap,
    ensureLoaded, persist, ownerCart, ownerTotal, isWished, ownerWishlist,
    addProduct: (input: Parameters<typeof addMallProduct>[1]) => addMallProduct(state, input),
    removeProduct: (productId: string) => removeMallProduct(state, productId),
    viewProduct: (productId: string) => viewMallProduct(state, productId),
    addToCart: (productId: string, owner: MallCartOwner, quantity = 1) => addMallCartItem(state, productId, owner, quantity),
    setQuantity: (itemId: string, quantity: number) => setMallCartQuantity(state, itemId, quantity),
    toggleWishlist: (productId: string, owner: MallCartOwner) => toggleMallWishlist(state, productId, owner),
    checkout: (owner: MallCartOwner, character?: { id: string; name: string }, productIds?: string[]) => checkoutStoryCart(state, owner, character, productIds),
    cancelOrder: (orderId: string) => cancelMallOrder(state, orderId),
    advanceOrder: (orderId: string) => advanceMallOrder(state, orderId),
    recordExternal: (product: MallProduct, status: Parameters<typeof recordExternalProduct>[2], owner: MallCartOwner) => recordExternalProduct(state, product, status, owner),
    addEvent: (event: Parameters<typeof addMallEvent>[1]) => addMallEvent(state, event),
    chatPermissions: (characterId: string) => effectiveMallChatPermissions(state, characterId)
  }
}
