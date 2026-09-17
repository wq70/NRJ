<!-- WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ -->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useMall } from '../composables/useMall'
import { mallExternalPlatforms } from '../services/mallService'
import { formatWalletMoney, loadWalletState } from '../services/walletService'
import type { MallCartOwner, MallExternalPurchaseStatus, MallPerspective, MallProduct } from '../types/mall'

const emit = defineEmits<{ (event: 'close'): void; (event: 'open-chat', characterId: string | number): void }>()
const mall = useMall()

type Tab = 'home' | 'browse' | 'together' | 'cart' | 'orders'
type Sheet = '' | 'settings' | 'product' | 'import' | 'create' | 'characters' | 'checkout' | 'external' | 'share'

const activeTab = ref<Tab>('home')
const sheet = ref<Sheet>('')
const perspective = ref<MallPerspective>('user')
const selectedCharacterId = ref('')
const selectedProductId = ref('')
const search = ref('')
const category = ref('全部')
const toast = ref('')
const toastError = ref(false)
const pendingExternalUrl = ref('')
const pendingExternalProductId = ref('')
const platformSearch = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined

const externalDraft = ref({ url: '', title: '', price: '', imageUrl: '', note: '' })
const storyDraft = ref({ title: '', price: '', emoji: '🎁', category: '自定义', description: '', storeName: '我的商店' })

onMounted(() => {
  mall.ensureLoaded()
  if (mall.characters.value.length) selectedCharacterId.value = String(mall.characters.value[0].characterEntityId || mall.characters.value[0].id)
})

const notify = (text: string, error = false) => {
  toast.value = text; toastError.value = error
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 2400)
}

const selectedCharacter = computed(() => mall.characters.value.find(item => String(item.characterEntityId || item.id) === selectedCharacterId.value) || null)
const characterName = computed(() => selectedCharacter.value?.name || 'TA')
const owner = computed<MallCartOwner>(() => perspective.value === 'character' && selectedCharacterId.value ? `character:${selectedCharacterId.value}` : perspective.value === 'together' ? 'together' : 'user')
const ownerLabel = computed(() => perspective.value === 'character' ? `${characterName.value}的` : perspective.value === 'together' ? '共同' : '我的')
const cartRows = computed(() => mall.ownerCart(owner.value))
const cartTotal = computed(() => mall.ownerTotal(owner.value))
const storyCartRows = computed(() => cartRows.value.filter(item => item.product.source !== 'external'))
const externalCartRows = computed(() => cartRows.value.filter(item => item.product.source === 'external'))
const wallet = computed(() => {
  void mall.state.updatedAt
  return loadWalletState(mall.accountId.value, mall.currentAccount.value?.name || '我')
})
const selectedProduct = computed(() => mall.state.products.find(item => item.id === selectedProductId.value) || null)
const categories = computed(() => ['全部', ...Array.from(new Set(mall.state.products.map(item => item.category)))])
const visibleProducts = computed(() => {
  const query = search.value.trim().toLowerCase()
  return mall.state.products.filter(product => {
    if (category.value !== '全部' && product.category !== category.value) return false
    if (!query) return true
    return [product.title, product.subtitle, product.storeName, product.category, ...product.tags].join(' ').toLowerCase().includes(query)
  })
})
const featured = computed(() => mall.state.products.filter(item => item.source === 'story').slice(0, 6))
const recent = computed(() => mall.state.recentlyViewedProductIds.map(id => mall.productMap.value.get(id)).filter(Boolean).slice(0, 6) as MallProduct[])
const wishes = computed(() => mall.ownerWishlist(owner.value))
const characterPermissions = computed(() => {
  const id = selectedCharacterId.value || '__none__'
  const base = { enabled: false, allowProductShare: false, includeRecentEvents: false, allowMemory: false }
  if (!mall.state.settings.characterPermissions[id]) mall.state.settings.characterPermissions[id] = { ...base }
  return mall.state.settings.characterPermissions[id]
})

const money = (value: number) => `¥${formatWalletMoney(value)}`
const orderStatus = (status: string) => ({ paid: '已付款', preparing: '备货中', shipped: '运输中', delivered: '已完成', cancelled: '已取消', refunded: '已退款' }[status] || status)
const externalStatus = (status?: MallExternalPurchaseStatus) => ({ saved: '已保存', considering: '正在考虑', purchased: '自行确认已购买', abandoned: '决定不买' }[status || 'saved'])

const selectPerspective = (next: MallPerspective) => {
  if (next === 'character' && !selectedCharacter.value) { sheet.value = 'characters'; return }
  perspective.value = next
}

const chooseCharacter = (character: any) => {
  selectedCharacterId.value = String(character.characterEntityId || character.id)
  perspective.value = 'character'; sheet.value = ''
}

const openProduct = (product: MallProduct) => {
  selectedProductId.value = product.id; mall.viewProduct(product.id); sheet.value = 'product'
}

const addCart = (product: MallProduct) => {
  mall.addToCart(product.id, owner.value)
  notify(product.source === 'external' ? '已放入候选清单，真实付款仍在原平台完成' : `已加入${ownerLabel.value}购物车`)
}

const toggleWish = (product: MallProduct) => {
  const added = mall.toggleWishlist(product.id, owner.value)
  notify(added ? `已加入${ownerLabel.value}愿望单` : '已移出愿望单')
}

const saveExternal = () => {
  try {
    const product = mall.addProduct({ source: 'external', title: externalDraft.value.title, subtitle: externalDraft.value.note, externalUrl: externalDraft.value.url, imageUrl: externalDraft.value.imageUrl, priceCents: Math.round(Number(externalDraft.value.price || 0) * 100) })
    mall.toggleWishlist(product.id, 'user')
    externalDraft.value = { url: '', title: '', price: '', imageUrl: '', note: '' }
    sheet.value = ''; notify('真实商品已保存，价格和购买状态由你确认')
  } catch (error) { notify(error instanceof Error ? error.message : '保存失败', true) }
}

const saveStoryProduct = () => {
  try {
    mall.addProduct({ source: 'custom', title: storyDraft.value.title, description: storyDraft.value.description, category: storyDraft.value.category, emoji: storyDraft.value.emoji, priceCents: Math.round(Number(storyDraft.value.price || 0) * 100), stock: 99, storeName: storyDraft.value.storeName })
    storyDraft.value = { title: '', price: '', emoji: '🎁', category: '自定义', description: '', storeName: '我的商店' }
    sheet.value = ''; notify('剧情商品已创建')
  } catch (error) { notify(error instanceof Error ? error.message : '创建失败', true) }
}

const openExternal = (url: string, productId = '') => {
  if (!url) return
  if (mall.state.settings.confirmExternalJump) {
    pendingExternalUrl.value = url; pendingExternalProductId.value = productId; sheet.value = 'external'; return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}

const confirmExternal = () => {
  const product = mall.state.products.find(item => item.id === pendingExternalProductId.value)
  if (product) mall.recordExternal(product, 'considering', owner.value)
  window.open(pendingExternalUrl.value, '_blank', 'noopener,noreferrer')
  sheet.value = ''; pendingExternalUrl.value = ''; pendingExternalProductId.value = ''
}

const searchPlatform = (platform: typeof mallExternalPlatforms[number]) => {
  const query = platformSearch.value.trim()
  openExternal(query ? platform.searchUrl(query) : platform.homeUrl)
}

const doCheckout = () => {
  try {
    const character = selectedCharacter.value ? { id: selectedCharacterId.value, name: selectedCharacter.value.name } : undefined
    const order = mall.checkout(owner.value, character)
    sheet.value = ''; activeTab.value = 'orders'; notify(`订单 ${order.id.slice(-6)} 已付款`)
  } catch (error) { notify(error instanceof Error ? error.message : '下单失败', true) }
}

const cancelOrder = (orderId: string) => {
  try { mall.cancelOrder(orderId); notify('订单已取消，款项已退回剧情钱包') }
  catch (error) { notify(error instanceof Error ? error.message : '取消失败', true) }
}

const markExternal = (product: MallProduct | undefined, status: MallExternalPurchaseStatus) => {
  if (!product) return notify('原商品已删除，无法更新这条记录', true)
  mall.recordExternal(product, status, owner.value); notify(status === 'purchased' ? '已记录：由你自行确认购买' : '购买记录已更新')
}

const persistChatMessage = (chat: any) => {
  const key = mall.accountId.value === 'guest' ? 'clingy_custom_contacts' : `clingy_custom_contacts_${mall.accountId.value}`
  try {
    const contacts = JSON.parse(localStorage.getItem(key) || '[]')
    const index = contacts.findIndex((item: any) => String(item.id) === String(chat.id))
    if (index < 0) return false
    contacts[index].messages = chat.messages
    contacts[index].preview = chat.preview
    contacts[index].time = chat.time
    localStorage.setItem(key, JSON.stringify(contacts)); return true
  } catch { return false }
}

const shareProduct = (product: MallProduct) => {
  if (!mall.state.settings.chat.enabled || !mall.state.settings.chat.allowProductShare) return notify('请先在商城设置中开启聊天联动和商品分享', true)
  selectedProductId.value = product.id; sheet.value = 'share'
}

const sendProductToCharacter = (character: any) => {
  const characterId = String(character.characterEntityId || character.id)
  const permissions = mall.chatPermissions(characterId)
  if (!permissions.allowProductShare) return notify('这个角色的商品分享权限尚未开启', true)
  const product = selectedProduct.value; if (!product) return
  const now = Date.now()
  const content = product.source === 'external'
    ? `我想和你看看这个真实平台商品：${product.title}${product.priceCents ? `（我记录的价格 ${money(product.priceCents)}，请以平台实时页面为准）` : ''}。${product.externalUrl || ''}`
    : `我在剧情商城看到「${product.title}」，价格 ${money(product.priceCents)}。想听听你的意见。`
  if (!Array.isArray(character.messages)) character.messages = []
  character.messages.push({ id: now, timestamp: now, type: 'right', content, source: 'mall', mallProductId: product.id })
  character.preview = `[商城] ${product.title}`
  character.time = new Date(now).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  persistChatMessage(character)
  mall.addEvent({ type: 'product_shared', title: `向${character.name}分享了商品`, detail: product.title, characterId, productId: product.id, chatEligible: true, memoryEligible: false })
  sheet.value = ''; notify(`已发给${character.name}`)
  emit('open-chat', character.id)
}

const updateSetting = () => mall.persist()
</script>

<template>
  <div class="mall-app">
    <header class="mall-topbar">
      <button class="icon-button" type="button" aria-label="返回桌面" @click="emit('close')">‹</button>
      <div class="title-block"><b>商城</b><small>和喜欢的人一起逛</small></div>
      <button class="icon-button settings-button" type="button" aria-label="商城设置" @click="sheet='settings'">•••</button>
    </header>

    <div class="perspective-bar">
      <button :class="{active:perspective==='user'}" @click="selectPerspective('user')">我</button>
      <button :class="{active:perspective==='together'}" @click="selectPerspective('together')">一起</button>
      <button :class="{active:perspective==='character'}" @click="selectPerspective('character')">{{ perspective==='character' ? characterName : 'TA' }}</button>
      <button v-if="mall.characters.value.length" class="character-picker" aria-label="选择角色" @click="sheet='characters'">⌄</button>
    </div>

    <main class="mall-main">
      <template v-if="activeTab==='home'">
        <section class="hero-card">
          <div><small>FOR TWO</small><h1>把喜欢变成<br>共同做过的事</h1><p>剧情消费与真实平台分开，陪逛可以很近，付款边界必须清楚。</p></div>
          <span>♡</span>
        </section>

        <section class="section-head"><div><h2>真实平台</h2><p>可以逛和跳转，不使用剧情钱包付款</p></div><button @click="sheet='import'">保存链接</button></section>
        <div class="platform-panel">
          <input v-model="platformSearch" maxlength="60" placeholder="搜索想买的东西" />
          <div><button v-for="platform in mallExternalPlatforms" :key="platform.id" @click="searchPlatform(platform)"><i :style="{background:platform.accent}">{{ platform.shortName }}</i><span>{{ platform.name }}</span></button></div>
        </div>

        <section class="section-head"><div><h2>为你们挑选</h2><p>{{ ownerLabel }}视角 · 点击商品查看详情</p></div><button @click="activeTab='browse'">全部</button></section>
        <div class="product-grid"><button v-for="product in featured" :key="product.id" class="product-card" @click="openProduct(product)"><span class="product-art">{{ product.emoji }}</span><small>{{ product.storeName }}</small><b>{{ product.title }}</b><p>{{ product.subtitle }}</p><strong>{{ money(product.priceCents) }}</strong></button></div>

        <template v-if="recent.length && mall.state.settings.showBrowsingHistory"><section class="section-head"><div><h2>最近看过</h2><p>只保存在当前商城数据中</p></div></section><div class="horizontal-products"><button v-for="product in recent" :key="product.id" @click="openProduct(product)"><span>{{product.emoji}}</span><b>{{product.title}}</b><small>{{money(product.priceCents)}}</small></button></div></template>
      </template>

      <template v-else-if="activeTab==='browse'">
        <div class="search-row"><input v-model="search" placeholder="搜索商品、店铺或标签" /><button @click="sheet='create'">＋</button></div>
        <div class="category-row"><button v-for="item in categories" :key="item" :class="{active:category===item}" @click="category=item">{{item}}</button></div>
        <div v-if="visibleProducts.length" class="product-grid browse-grid"><button v-for="product in visibleProducts" :key="product.id" class="product-card" @click="openProduct(product)"><span v-if="product.source==='external'" class="source-chip">真实平台</span><span class="product-art">{{ product.emoji }}</span><small>{{ product.storeName }}</small><b>{{ product.title }}</b><p>{{ product.subtitle }}</p><strong>{{ product.priceCents ? money(product.priceCents) : '价格待确认' }}</strong></button></div>
        <div v-else class="empty-state"><span>⌕</span><b>没有找到</b><p>换个关键词，或创建自己的剧情商品。</p></div>
      </template>

      <template v-else-if="activeTab==='together'">
        <section class="together-intro"><span>♡</span><div><small>SHOPPING TOGETHER</small><h2>一起做决定</h2><p>{{ selectedCharacter ? `当前和 ${characterName} 一起整理愿望与候选商品。` : '选择一位角色，开始共同购物。' }}</p></div><button @click="sheet='characters'">{{ selectedCharacter ? '换人' : '选择角色' }}</button></section>
        <section class="section-head"><div><h2>共同愿望单</h2><p>{{ wishes.length }} 件想一起完成的事</p></div></section>
        <div v-if="wishes.length" class="wish-list"><button v-for="product in wishes" :key="product.id" @click="openProduct(product)"><span>{{product.emoji}}</span><div><b>{{product.title}}</b><small>{{product.subtitle}}</small></div><strong>{{product.priceCents?money(product.priceCents):'待确认'}}</strong></button></div>
        <div v-else class="empty-state compact"><span>♡</span><b>共同愿望单还是空的</b><p>切换到“一起”视角，再收藏喜欢的商品。</p></div>
        <section class="section-head"><div><h2>一起挑</h2><p>把候选商品放进共同购物车</p></div></section>
        <div class="horizontal-products"><button v-for="product in featured.slice(0,5)" :key="product.id" @click="openProduct(product)"><span>{{product.emoji}}</span><b>{{product.title}}</b><small>{{money(product.priceCents)}}</small></button></div>
      </template>

      <template v-else-if="activeTab==='cart'">
        <section class="cart-title"><div><small>{{ownerLabel}}清单</small><h2>购物车</h2></div><strong>{{cartRows.length}} 种</strong></section>
        <div v-if="cartRows.length" class="cart-list"><article v-for="row in cartRows" :key="row.id"><span>{{row.product.emoji}}</span><div><small>{{row.product.source==='external'?'真实平台 · 不扣剧情钱包':row.product.storeName}}</small><b>{{row.product.title}}</b><strong>{{row.product.priceCents?money(row.product.priceCents):'价格待确认'}}</strong></div><div class="quantity"><button @click="mall.setQuantity(row.id,row.quantity-1)">−</button><i>{{row.quantity}}</i><button @click="mall.setQuantity(row.id,row.quantity+1)">＋</button></div></article></div>
        <div v-else class="empty-state"><span>袋</span><b>购物车还是空的</b><p>去逛逛，或者把真实商品保存进候选清单。</p><button @click="activeTab='browse'">去逛逛</button></div>
        <section v-if="storyCartRows.length" class="checkout-bar"><div><small>剧情商品合计</small><b>{{money(storyCartRows.reduce((sum,row)=>sum+row.product.priceCents*row.quantity,0))}}</b><p>剧情钱包余额 {{money(wallet.cashCents)}}</p></div><button @click="sheet='checkout'">确认订单</button></section>
        <section v-if="externalCartRows.length" class="external-note"><b>真实平台商品</b><p>逐件前往原平台查看实时价格、库存并完成真实付款。</p><button v-for="row in externalCartRows" :key="row.id" @click="openExternal(row.product.externalUrl||'',row.product.id)">前往{{row.product.platform||'平台'}} · {{row.product.title}}</button></section>
      </template>

      <template v-else-if="activeTab==='orders'">
        <section class="cart-title"><div><small>PURCHASES</small><h2>订单与购买记录</h2></div></section>
        <div v-if="mall.state.orders.length" class="order-list"><article v-for="order in mall.state.orders" :key="order.id"><header><span>{{order.source==='story'?'剧情订单':`${order.platform||'真实平台'}记录`}}</span><b>{{order.source==='story'?orderStatus(order.status):externalStatus(order.externalPurchaseStatus)}}</b></header><div v-for="item in order.items" :key="item.productId"><i>{{item.emoji}}</i><p><b>{{item.title}}</b><small>{{item.quantity}} 件 · {{item.unitPriceCents?money(item.unitPriceCents):'价格待确认'}}</small></p></div><footer><small>{{new Date(order.createdAt).toLocaleString('zh-CN')}}</small><strong>{{order.totalCents?money(order.totalCents):'—'}}</strong></footer><nav v-if="order.source==='story'"><button v-if="['paid','preparing'].includes(order.status)" @click="cancelOrder(order.id)">取消并退款</button><button v-if="['paid','preparing','shipped'].includes(order.status)" @click="mall.advanceOrder(order.id)">{{order.status==='paid'?'开始备货':order.status==='preparing'?'模拟发货':'确认收货'}}</button></nav><nav v-else><button v-if="order.externalUrl" @click="openExternal(order.externalUrl,order.items[0]?.productId)">前往平台</button><button @click="markExternal(mall.productMap.value.get(order.items[0]?.productId)!, 'purchased')">标记已购买</button></nav></article></div>
        <div v-else class="empty-state"><span>单</span><b>还没有订单</b><p>剧情订单与用户自行登记的真实购买会出现在这里。</p></div>
      </template>
    </main>

    <nav class="mall-tabs"><button :class="{active:activeTab==='home'}" @click="activeTab='home'"><i>⌂</i><span>首页</span></button><button :class="{active:activeTab==='browse'}" @click="activeTab='browse'"><i>◇</i><span>逛逛</span></button><button :class="{active:activeTab==='together'}" @click="activeTab='together';perspective='together'"><i>♡</i><span>我们</span></button><button :class="{active:activeTab==='cart'}" @click="activeTab='cart'"><i>袋</i><span>购物车</span><em v-if="cartRows.length">{{cartRows.length}}</em></button><button :class="{active:activeTab==='orders'}" @click="activeTab='orders'"><i>单</i><span>订单</span></button></nav>

    <div v-if="sheet" class="sheet-overlay" @click.self="sheet=''">
      <section v-if="sheet==='product' && selectedProduct" class="bottom-sheet product-sheet"><header><span>{{selectedProduct.source==='external'?'真实平台商品':'剧情商品'}}</span><button @click="sheet=''">×</button></header><div class="detail-art"><img v-if="selectedProduct.imageUrl" :src="selectedProduct.imageUrl" alt="" /><span v-else>{{selectedProduct.emoji}}</span></div><small>{{selectedProduct.storeName}}</small><h2>{{selectedProduct.title}}</h2><p class="subtitle">{{selectedProduct.subtitle}}</p><strong class="detail-price">{{selectedProduct.priceCents?money(selectedProduct.priceCents):'价格待确认'}}</strong><p class="description">{{selectedProduct.description||'这件商品还没有补充更多介绍。'}}</p><div class="tag-row"><i v-for="tag in selectedProduct.tags" :key="tag">{{tag}}</i></div><p v-if="selectedProduct.source==='external'" class="boundary-note">这是用户保存的真实平台链接。实时价格、库存、订单和付款均以原平台为准，剧情钱包不会扣款。</p><footer><button :class="{active:mall.isWished(selectedProduct.id,owner)}" @click="toggleWish(selectedProduct)">♡ {{mall.isWished(selectedProduct.id,owner)?'已收藏':'愿望单'}}</button><button v-if="mall.characters.value.length" @click="shareProduct(selectedProduct)">发给TA</button><button class="primary" @click="selectedProduct.source==='external'?openExternal(selectedProduct.externalUrl||'',selectedProduct.id):addCart(selectedProduct)">{{selectedProduct.source==='external'?'前往平台':'加入购物车'}}</button></footer><button v-if="selectedProduct.userCreated" class="delete-product" @click="mall.removeProduct(selectedProduct.id);sheet='';notify('自建商品已删除')">删除这件自建商品</button></section>

      <section v-else-if="sheet==='settings'" class="bottom-sheet settings-sheet"><header><div><small>PRIVACY & CHAT</small><h2>商城设置</h2></div><button @click="sheet=''">×</button></header><div class="setting-group"><h3>聊天联动</h3><p>全部默认关闭。关闭总开关时不注入商城提示词，也不允许发送商品卡。</p><label><span><b>商城连接聊天</b><small>总开关</small></span><input v-model="mall.state.settings.chat.enabled" type="checkbox" @change="updateSetting"><i></i></label><label class="nested"><span><b>允许发送商品</b><small>仍需为具体角色单独开启</small></span><input v-model="mall.state.settings.chat.allowProductShare" :disabled="!mall.state.settings.chat.enabled" type="checkbox" @change="updateSetting"><i></i></label><label class="nested"><span><b>最近事件进入上下文</b><small>最多读取已授权的 {{mall.state.settings.contextEventLimit}} 条</small></span><input v-model="mall.state.settings.chat.includeRecentEvents" :disabled="!mall.state.settings.chat.enabled" type="checkbox" @change="updateSetting"><i></i></label><label class="nested"><span><b>允许商城长期记忆</b><small>只授权能力，不会自动写入</small></span><input v-model="mall.state.settings.chat.allowMemory" :disabled="!mall.state.settings.chat.enabled" type="checkbox" @change="updateSetting"><i></i></label></div><div v-if="selectedCharacter" class="setting-group"><h3>{{characterName}}的权限</h3><p>全局和角色开关必须同时开启才生效。</p><label><span><b>允许联动</b><small>当前角色</small></span><input v-model="characterPermissions!.enabled" type="checkbox" @change="updateSetting"><i></i></label><label class="nested"><span><b>允许接收商品</b></span><input v-model="characterPermissions!.allowProductShare" :disabled="!characterPermissions!.enabled" type="checkbox" @change="updateSetting"><i></i></label><label class="nested"><span><b>读取最近商城事件</b></span><input v-model="characterPermissions!.includeRecentEvents" :disabled="!characterPermissions!.enabled" type="checkbox" @change="updateSetting"><i></i></label><label class="nested"><span><b>允许写入长期记忆</b></span><input v-model="characterPermissions!.allowMemory" :disabled="!characterPermissions!.enabled" type="checkbox" @change="updateSetting"><i></i></label></div><div class="setting-group"><h3>浏览与跳转</h3><label><span><b>显示最近看过</b><small>数据只保存在商城快照中</small></span><input v-model="mall.state.settings.showBrowsingHistory" type="checkbox" @change="updateSetting"><i></i></label><label><span><b>跳转真实平台前确认</b><small>避免误触离开应用</small></span><input v-model="mall.state.settings.confirmExternalJump" type="checkbox" @change="updateSetting"><i></i></label></div></section>

      <section v-else-if="sheet==='characters'" class="bottom-sheet"><header><div><small>PERSPECTIVE</small><h2>选择角色</h2></div><button @click="sheet=''">×</button></header><div v-if="mall.characters.value.length" class="character-list"><button v-for="character in mall.characters.value" :key="character.id" @click="chooseCharacter(character)"><span :style="character.avatarUrl?{backgroundImage:`url(${character.avatarUrl})`}:{}">{{character.avatarUrl?'':character.avatarText}}</span><div><b>{{character.name}}</b><small>查看 TA 的愿望与购物车</small></div><i>›</i></button></div><div v-else class="empty-state compact"><span>人</span><b>还没有角色联系人</b><p>先在聊天中创建角色，商城才会出现角色视角。</p></div></section>

      <section v-else-if="sheet==='share'" class="bottom-sheet"><header><div><small>SHARE TO CHAT</small><h2>发给谁</h2></div><button @click="sheet=''">×</button></header><p class="sheet-note">只有同时开启全局和角色商品分享权限的联系人才能接收。</p><div class="character-list"><button v-for="character in mall.characters.value" :key="character.id" @click="sendProductToCharacter(character)"><span :style="character.avatarUrl?{backgroundImage:`url(${character.avatarUrl})`}:{}">{{character.avatarUrl?'':character.avatarText}}</span><div><b>{{character.name}}</b><small>{{mall.chatPermissions(String(character.characterEntityId||character.id)).allowProductShare?'可以发送':'权限未开启'}}</small></div><i>›</i></button></div></section>

      <section v-else-if="sheet==='import'" class="bottom-sheet form-sheet"><header><div><small>REAL PRODUCT</small><h2>保存真实商品</h2></div><button @click="sheet=''">×</button></header><p class="sheet-note">不会登录平台或读取订单。请自行确认名称和价格，付款始终在原平台完成。</p><label><span>商品链接</span><input v-model="externalDraft.url" inputmode="url" placeholder="https://..." /></label><label><span>商品名称</span><input v-model="externalDraft.title" maxlength="80" placeholder="必填" /></label><div class="form-pair"><label><span>记录价格</span><input v-model="externalDraft.price" inputmode="decimal" placeholder="可不填" /></label><label><span>图片地址</span><input v-model="externalDraft.imageUrl" inputmode="url" placeholder="可不填" /></label></div><label><span>备注</span><input v-model="externalDraft.note" maxlength="100" placeholder="规格、送给谁、为什么喜欢" /></label><button class="form-submit" @click="saveExternal">保存到愿望单</button></section>

      <section v-else-if="sheet==='create'" class="bottom-sheet form-sheet"><header><div><small>STORY PRODUCT</small><h2>创建剧情商品</h2></div><button @click="sheet=''">×</button></header><p class="sheet-note">剧情商品使用应用内虚拟钱包，不对应真实商品或人民币。</p><div class="form-pair"><label><span>商品名称</span><input v-model="storyDraft.title" maxlength="60" /></label><label><span>虚拟价格</span><input v-model="storyDraft.price" inputmode="decimal" /></label></div><div class="form-pair"><label><span>图标</span><input v-model="storyDraft.emoji" maxlength="4" /></label><label><span>分类</span><input v-model="storyDraft.category" maxlength="20" /></label></div><label><span>店铺</span><input v-model="storyDraft.storeName" maxlength="40" /></label><label><span>介绍</span><textarea v-model="storyDraft.description" maxlength="300"></textarea></label><button class="form-submit" @click="saveStoryProduct">创建商品</button></section>

      <section v-else-if="sheet==='checkout'" class="confirm-card"><small>STORY CHECKOUT</small><h2>确认剧情订单</h2><p>本次只结算剧情商品，不会处理真实平台商品。</p><div><span>商品</span><b>{{storyCartRows.reduce((sum,row)=>sum+row.quantity,0)}} 件</b></div><div><span>剧情钱包余额</span><b>{{money(wallet.cashCents)}}</b></div><div class="total"><span>需支付</span><b>{{money(storyCartRows.reduce((sum,row)=>sum+row.product.priceCents*row.quantity,0))}}</b></div><footer><button @click="sheet=''">再想想</button><button class="primary" @click="doCheckout">确认支付</button></footer></section>

      <section v-else-if="sheet==='external'" class="confirm-card"><small>LEAVE APP</small><h2>前往真实平台</h2><p>接下来显示的是第三方平台。实时价格、库存、登录、支付和售后均由该平台负责；剧情钱包不会扣款。</p><footer><button @click="sheet=''">取消</button><button class="primary" @click="confirmExternal">继续前往</button></footer></section>
    </div>

    <Transition name="toast"><div v-if="toast" class="mall-toast" :class="{error:toastError}">{{toast}}</div></Transition>
  </div>
</template>

<style scoped>
.mall-app{position:absolute;inset:0;z-index:1000;display:flex;min-width:0;flex-direction:column;overflow:hidden;background:#f5f3ef;color:#262522;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;-webkit-tap-highlight-color:transparent}.mall-topbar{display:grid;height:52px;box-sizing:border-box;grid-template-columns:42px minmax(0,1fr) 42px;align-items:center;padding:calc(3px + env(safe-area-inset-top,0px)) 10px 0;background:rgba(245,243,239,.94);backdrop-filter:blur(16px);z-index:5}.icon-button{display:grid;width:34px;height:34px;place-items:center;border:0;border-radius:50%;background:transparent;color:inherit;font:inherit;font-size:26px}.settings-button{justify-self:end;font-size:14px;letter-spacing:1px}.title-block{min-width:0;text-align:center}.title-block b,.title-block small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.title-block b{font:600 15px Georgia,"Songti SC",serif}.title-block small{margin-top:1px;color:#99948b;font-size:9px;letter-spacing:.08em}.perspective-bar{display:flex;height:36px;flex:none;align-items:center;justify-content:center;gap:4px;border-bottom:1px solid rgba(62,57,48,.07);background:rgba(245,243,239,.94)}.perspective-bar button{min-width:50px;height:25px;padding:0 13px;border:0;border-radius:13px;background:transparent;color:#8d887e;font:inherit;font-size:11px}.perspective-bar button.active{background:#2f2d29;color:#fff}.perspective-bar .character-picker{min-width:24px;width:24px;padding:0}.mall-main{min-width:0;min-height:0;flex:1;overflow-x:hidden;overflow-y:auto;padding:12px 12px calc(82px + env(safe-area-inset-bottom,0px));box-sizing:border-box}.hero-card{position:relative;display:flex;min-height:158px;overflow:hidden;justify-content:space-between;border-radius:18px;background:#d9d2c5;padding:22px 20px;color:#26231f}.hero-card:after{position:absolute;right:-35px;bottom:-62px;width:170px;height:170px;border:1px solid rgba(255,255,255,.55);border-radius:50%;content:""}.hero-card small,.together-intro small,.confirm-card>small,.bottom-sheet header small{font-size:8px;letter-spacing:.2em}.hero-card h1{margin:8px 0 7px;font:500 25px/1.22 Georgia,"Songti SC",serif}.hero-card p{max-width:220px;margin:0;color:#686158;font-size:10px;line-height:1.6}.hero-card>span{align-self:center;color:rgba(255,255,255,.8);font:42px Georgia,serif;z-index:1}.section-head{display:flex;min-width:0;align-items:flex-end;justify-content:space-between;margin:20px 2px 9px}.section-head>div{min-width:0}.section-head h2{margin:0;font:600 16px Georgia,"Songti SC",serif}.section-head p{margin:3px 0 0;overflow:hidden;color:#9b968d;font-size:9px;text-overflow:ellipsis;white-space:nowrap}.section-head>button{flex:none;border:0;background:transparent;color:#706b62;font:inherit;font-size:10px}.platform-panel{border:1px solid rgba(62,57,48,.07);border-radius:14px;background:#fff;padding:10px}.platform-panel>input,.search-row input{box-sizing:border-box;width:100%;height:34px;border:0;border-radius:9px;outline:0;background:#f4f2ee;padding:0 11px;color:inherit;font:inherit;font-size:11px}.platform-panel>div{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;margin-top:9px}.platform-panel button{display:flex;min-width:0;align-items:center;flex-direction:column;gap:4px;border:0;background:transparent;color:#625e57;font:inherit;font-size:9px}.platform-panel button i{display:grid;width:28px;height:28px;place-items:center;border-radius:9px;color:#fff;font-size:11px;font-style:normal}.product-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.product-card{position:relative;display:flex;min-width:0;overflow:hidden;align-items:flex-start;flex-direction:column;border:0;border-radius:14px;background:#fff;padding:9px;text-align:left;color:inherit}.product-art{display:grid;width:100%;aspect-ratio:1.5;place-items:center;border-radius:10px;background:linear-gradient(145deg,#f0ece5,#e5ded3);font-size:40px}.product-card>small{max-width:100%;margin-top:8px;overflow:hidden;color:#a29d94;font-size:8px;text-overflow:ellipsis;white-space:nowrap}.product-card>b{max-width:100%;margin-top:3px;overflow:hidden;font-size:12px;text-overflow:ellipsis;white-space:nowrap}.product-card>p{display:-webkit-box;min-height:27px;margin:3px 0;color:#858078;font-size:9px;line-height:1.45;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}.product-card>strong{margin-top:4px;font:600 12px Georgia,serif}.source-chip{position:absolute;top:15px;left:15px;z-index:1;border-radius:8px;background:rgba(41,39,36,.78);padding:3px 6px;color:#fff;font-size:7px}.horizontal-products{display:flex;gap:8px;overflow-x:auto;padding-bottom:2px;scrollbar-width:none}.horizontal-products button{display:flex;width:88px;min-width:88px;align-items:flex-start;flex-direction:column;border:0;border-radius:12px;background:#fff;padding:8px;color:inherit;text-align:left}.horizontal-products span{display:grid;width:100%;height:54px;place-items:center;border-radius:8px;background:#eee9e1;font-size:26px}.horizontal-products b,.horizontal-products small{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.horizontal-products b{margin-top:6px;font-size:10px}.horizontal-products small{margin-top:2px;color:#8c877e;font-size:8px}.search-row{display:flex;gap:7px;margin-bottom:9px}.search-row input{flex:1}.search-row button{width:34px;flex:none;border:0;border-radius:9px;background:#2f2d29;color:#fff;font-size:17px}.category-row{display:flex;gap:5px;overflow-x:auto;margin:0 -12px 10px;padding:0 12px;scrollbar-width:none}.category-row button{height:25px;flex:none;padding:0 11px;border:1px solid #ddd8cf;border-radius:13px;background:transparent;color:#817c73;font:inherit;font-size:9px}.category-row button.active{border-color:#34312d;background:#34312d;color:#fff}.browse-grid{padding-bottom:4px}.empty-state{display:flex;min-height:260px;align-items:center;justify-content:center;flex-direction:column;color:#9a958c;text-align:center}.empty-state.compact{min-height:150px}.empty-state>span{display:grid;width:44px;height:44px;place-items:center;border:1px solid #d9d4ca;border-radius:50%;font:18px Georgia,serif}.empty-state>b{margin-top:10px;color:#555149;font-size:12px}.empty-state>p{max-width:230px;margin:5px 0 0;font-size:10px;line-height:1.6}.empty-state>button{margin-top:12px;border:0;border-radius:15px;background:#37342f;padding:7px 15px;color:#fff;font:inherit;font-size:10px}.together-intro{display:grid;grid-template-columns:40px minmax(0,1fr) auto;align-items:center;gap:10px;border-radius:15px;background:#ddd3d1;padding:15px}.together-intro>span{font:30px Georgia,serif}.together-intro div{min-width:0}.together-intro h2{margin:4px 0 3px;font:600 17px Georgia,"Songti SC",serif}.together-intro p{margin:0;color:#77706a;font-size:9px;line-height:1.5}.together-intro button{border:0;border-radius:12px;background:rgba(255,255,255,.72);padding:6px 9px;color:#5d5752;font:inherit;font-size:9px}.wish-list{display:grid;gap:6px}.wish-list button{display:grid;min-width:0;grid-template-columns:42px minmax(0,1fr) auto;align-items:center;gap:8px;border:0;border-radius:11px;background:#fff;padding:8px;color:inherit;text-align:left}.wish-list>button>span{display:grid;width:42px;height:42px;place-items:center;border-radius:9px;background:#eee9e2;font-size:21px}.wish-list div{min-width:0}.wish-list b,.wish-list small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.wish-list b{font-size:11px}.wish-list small{margin-top:3px;color:#918c83;font-size:8px}.wish-list strong{font-size:10px}.cart-title{display:flex;align-items:flex-end;justify-content:space-between;margin:4px 2px 14px}.cart-title small{color:#9e998f;font-size:8px;letter-spacing:.16em}.cart-title h2{margin:3px 0 0;font:600 21px Georgia,"Songti SC",serif}.cart-title>strong{color:#8f8a81;font-size:10px}.cart-list{display:grid;gap:7px}.cart-list article{display:grid;min-width:0;grid-template-columns:48px minmax(0,1fr) auto;align-items:center;gap:9px;border-radius:12px;background:#fff;padding:9px}.cart-list article>span{display:grid;width:48px;height:48px;place-items:center;border-radius:10px;background:#eee9e1;font-size:23px}.cart-list article>div:nth-child(2){min-width:0}.cart-list small,.cart-list b,.cart-list strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cart-list small{color:#99948b;font-size:8px}.cart-list b{margin:3px 0;font-size:11px}.cart-list strong{font-size:10px}.quantity{display:flex;align-items:center;gap:5px}.quantity button{display:grid;width:23px;height:23px;place-items:center;border:1px solid #e1ddd5;border-radius:50%;background:transparent;color:#656057}.quantity i{min-width:16px;text-align:center;font-size:9px;font-style:normal}.checkout-bar{display:flex;align-items:center;justify-content:space-between;margin-top:12px;border-radius:14px;background:#302d29;padding:12px 13px;color:#fff}.checkout-bar small,.checkout-bar b,.checkout-bar p{display:block;margin:0}.checkout-bar small{color:#aaa49b;font-size:8px}.checkout-bar b{margin:2px 0;font:600 16px Georgia,serif}.checkout-bar p{color:#aaa49b;font-size:8px}.checkout-bar button{border:0;border-radius:14px;background:#f0e8db;padding:8px 12px;color:#2f2c28;font:inherit;font-size:10px}.external-note{margin-top:10px;border:1px solid #ddd7cd;border-radius:12px;padding:11px}.external-note>b{font-size:11px}.external-note>p{margin:4px 0 8px;color:#89847b;font-size:9px;line-height:1.5}.external-note>button{display:block;width:100%;overflow:hidden;border:0;border-top:1px solid #e1ddd5;background:transparent;padding:8px 0;color:#5f5a52;font:inherit;font-size:9px;text-align:left;text-overflow:ellipsis;white-space:nowrap}.order-list{display:grid;gap:9px}.order-list article{border-radius:13px;background:#fff;padding:11px}.order-list header,.order-list footer,.order-list nav{display:flex;align-items:center;justify-content:space-between}.order-list header{padding-bottom:8px;border-bottom:1px solid #f0ede8;font-size:9px}.order-list header b{color:#8a635d}.order-list article>div{display:flex;align-items:center;gap:9px;padding:9px 0}.order-list article>div i{display:grid;width:38px;height:38px;place-items:center;border-radius:8px;background:#eee9e2;font-size:20px;font-style:normal}.order-list article>div p{min-width:0;margin:0}.order-list article>div b,.order-list article>div small{display:block}.order-list article>div b{font-size:10px}.order-list article>div small,.order-list footer small{margin-top:3px;color:#98938a;font-size:8px}.order-list footer{padding-top:7px;border-top:1px solid #f0ede8}.order-list footer strong{font:600 11px Georgia,serif}.order-list nav{justify-content:flex-end;gap:6px;margin-top:9px}.order-list nav button{border:1px solid #ddd8cf;border-radius:12px;background:transparent;padding:6px 9px;color:#625d55;font:inherit;font-size:8px}.mall-tabs{position:absolute;right:0;bottom:0;left:0;z-index:6;display:grid;height:calc(57px + env(safe-area-inset-bottom,0px));grid-template-columns:repeat(5,minmax(0,1fr));align-items:start;border-top:1px solid rgba(57,53,47,.08);background:rgba(250,249,247,.96);padding:5px 5px env(safe-area-inset-bottom,0px);backdrop-filter:blur(16px);box-sizing:border-box}.mall-tabs button{position:relative;display:flex;min-width:0;height:44px;align-items:center;justify-content:center;flex-direction:column;gap:1px;border:0;background:transparent;color:#9a958d;font:inherit}.mall-tabs button.active{color:#2f2c28}.mall-tabs i{font:16px Georgia,serif}.mall-tabs span{font-size:8px}.mall-tabs em{position:absolute;top:0;right:19%;min-width:14px;height:14px;border-radius:7px;background:#8d5c58;color:#fff;font-size:8px;font-style:normal;line-height:14px}.sheet-overlay{position:absolute;inset:0;z-index:20;display:flex;align-items:flex-end;justify-content:center;background:rgba(27,25,22,.34)}.bottom-sheet{box-sizing:border-box;width:100%;max-height:86%;overflow-y:auto;border-radius:18px 18px 0 0;background:#f8f7f4;padding:14px 15px calc(14px + env(safe-area-inset-bottom,0px))}.bottom-sheet>header{display:flex;min-width:0;align-items:center;justify-content:space-between;margin-bottom:12px}.bottom-sheet>header h2{margin:3px 0 0;font:600 18px Georgia,"Songti SC",serif}.bottom-sheet>header>button{display:grid;width:28px;height:28px;place-items:center;border:0;border-radius:50%;background:#eae7e1;color:#777168;font-size:17px}.product-sheet>header>span{border-radius:9px;background:#e9e4dc;padding:4px 7px;color:#716b62;font-size:8px}.detail-art{display:grid;width:100%;height:160px;overflow:hidden;place-items:center;border-radius:14px;background:linear-gradient(145deg,#eee9e1,#ddd5ca)}.detail-art span{font-size:62px}.detail-art img{width:100%;height:100%;object-fit:cover}.product-sheet>small{display:block;margin-top:12px;color:#99948b;font-size:8px}.product-sheet>h2{margin:4px 0 2px;font:600 21px Georgia,"Songti SC",serif}.product-sheet .subtitle{margin:0;color:#827d74;font-size:10px}.detail-price{display:block;margin-top:9px;font:600 17px Georgia,serif}.description{color:#6f6a62;font-size:10px;line-height:1.65}.tag-row{display:flex;flex-wrap:wrap;gap:5px}.tag-row i{border-radius:9px;background:#ebe7df;padding:3px 7px;color:#777168;font-size:8px;font-style:normal}.boundary-note,.sheet-note{border-radius:10px;background:#eeeae3;padding:8px 10px;color:#777169;font-size:9px;line-height:1.55}.product-sheet>footer{display:grid;grid-template-columns:auto auto minmax(90px,1fr);gap:6px;margin-top:13px}.product-sheet>footer button,.confirm-card footer button{min-width:0;height:34px;border:1px solid #d9d4cb;border-radius:17px;background:transparent;padding:0 10px;color:#5e5951;font:inherit;font-size:9px}.product-sheet>footer button.active{color:#865f5b}.product-sheet>footer .primary,.confirm-card footer .primary{border-color:#332f2b;background:#332f2b;color:#fff}.delete-product{display:block;margin:13px auto 0;border:0;background:transparent;color:#a36b65;font:inherit;font-size:9px}.setting-group{margin-top:11px;border-radius:12px;background:#fff;padding:0 11px}.setting-group h3{margin:0;padding:11px 0 3px;font-size:11px}.setting-group>p{margin:0;padding-bottom:7px;color:#9b968d;font-size:8px;line-height:1.5}.setting-group label{display:grid;min-height:47px;grid-template-columns:minmax(0,1fr) 35px;align-items:center;border-top:1px solid #f0ede8}.setting-group label.nested{padding-left:10px}.setting-group label span{min-width:0}.setting-group label b,.setting-group label small{display:block}.setting-group label b{font-size:10px}.setting-group label small{margin-top:2px;color:#9a958d;font-size:8px}.setting-group input{position:absolute;opacity:0;pointer-events:none}.setting-group label>i{position:relative;width:32px;height:18px;border-radius:9px;background:#d8d4cd}.setting-group label>i:after{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:#fff;content:"";transition:.18s}.setting-group input:checked+i{background:#45413b}.setting-group input:checked+i:after{transform:translateX(14px)}.setting-group input:disabled+i{opacity:.45}.character-list{display:grid;gap:3px}.character-list>button{display:grid;min-width:0;grid-template-columns:40px minmax(0,1fr) 15px;align-items:center;gap:9px;border:0;border-bottom:1px solid #e9e6df;background:transparent;padding:8px 2px;color:inherit;text-align:left}.character-list>button>span{display:grid;width:40px;height:40px;place-items:center;border-radius:50%;background:#ddd7ce;background-position:center;background-size:cover;color:#6e685f;font-size:11px}.character-list div{min-width:0}.character-list b,.character-list small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.character-list b{font-size:11px}.character-list small{margin-top:3px;color:#98938a;font-size:8px}.character-list i{color:#aaa49a;font-style:normal}.form-sheet label{display:block;margin-top:9px}.form-sheet label>span{display:block;margin-bottom:4px;color:#777169;font-size:9px}.form-sheet input,.form-sheet textarea{box-sizing:border-box;width:100%;border:1px solid #ddd8cf;border-radius:9px;outline:0;background:#fff;padding:9px 10px;color:inherit;font:inherit;font-size:10px}.form-sheet textarea{min-height:72px;resize:none}.form-pair{display:grid;grid-template-columns:1fr 1fr;gap:7px}.form-submit{width:100%;height:36px;margin-top:14px;border:0;border-radius:18px;background:#332f2b;color:#fff;font:inherit;font-size:10px}.confirm-card{box-sizing:border-box;width:calc(100% - 28px);max-width:380px;margin:auto;border-radius:16px;background:#f8f7f4;padding:17px}.confirm-card h2{margin:5px 0 7px;font:600 19px Georgia,"Songti SC",serif}.confirm-card>p{color:#827d74;font-size:10px;line-height:1.6}.confirm-card>div{display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-top:1px solid #e4e0d9;font-size:10px}.confirm-card>div.total b{font:600 15px Georgia,serif}.confirm-card footer{display:flex;justify-content:flex-end;gap:7px;margin-top:11px}.mall-toast{position:absolute;right:18px;bottom:calc(68px + env(safe-area-inset-bottom,0px));left:18px;z-index:40;border-radius:10px;background:#35322e;padding:9px 12px;color:#fff;font-size:10px;text-align:center;box-shadow:0 8px 25px rgba(0,0,0,.2)}.mall-toast.error{background:#8d4f49}.toast-enter-active,.toast-leave-active{transition:.18s}.toast-enter-from,.toast-leave-to{transform:translateY(8px);opacity:0}.dark-theme .mall-app{background:#191817;color:#eeeae4}.dark-theme .mall-topbar,.dark-theme .perspective-bar{background:rgba(25,24,23,.94)}.dark-theme .mall-tabs{background:rgba(29,28,27,.96)}.dark-theme .product-card,.dark-theme .platform-panel,.dark-theme .cart-list article,.dark-theme .wish-list button,.dark-theme .order-list article,.dark-theme .setting-group{background:#242321}.dark-theme .platform-panel input,.dark-theme .search-row input{background:#2d2b28;color:#eee}.dark-theme .product-art,.dark-theme .horizontal-products span,.dark-theme .cart-list article>span,.dark-theme .order-list article>div i{background:#302d29}.dark-theme .bottom-sheet,.dark-theme .confirm-card{background:#211f1d}.dark-theme .form-sheet input,.dark-theme .form-sheet textarea{border-color:#3a3733;background:#292724;color:#eee}.dark-theme .setting-group label,.dark-theme .order-list header,.dark-theme .order-list footer{border-color:#34312d}@media(max-width:340px){.mall-main{padding-right:9px;padding-left:9px}.hero-card{min-height:145px;padding:18px 15px}.hero-card h1{font-size:22px}.product-grid{gap:7px}.product-card{padding:7px}.platform-panel>div{gap:2px}.perspective-bar button{min-width:44px;padding:0 9px}.product-sheet>footer{grid-template-columns:1fr 1fr}.product-sheet>footer .primary{grid-column:1/-1}.form-pair{grid-template-columns:1fr}.cart-list article{grid-template-columns:42px minmax(0,1fr)}.cart-list article>span{width:42px;height:42px}.quantity{grid-column:2;justify-self:end}.mall-tabs em{right:12%}}
</style>
