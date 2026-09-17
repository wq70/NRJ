<!-- WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ -->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useMall } from '../composables/useMall'
import { formatWalletMoney, loadWalletState } from '../services/walletService'
import { mallExternalPlatforms } from '../services/mallService'
import type { MallCartOwner, MallProduct } from '../types/mall'

const emit = defineEmits<{ (event: 'close'): void; (event: 'open-mall'): void }>()
const mall = useMall()
const selectedCharacterId = ref('')
const selectedCategory = ref('全部')
const query = ref('')
const chosenId = ref('')
const showCheckout = ref(false)
const showExternal = ref(false)
const pendingUrl = ref('')
const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined

onMounted(() => {
  mall.ensureLoaded()
  if (mall.characters.value.length) selectedCharacterId.value = String(mall.characters.value[0].characterEntityId || mall.characters.value[0].id)
})

const character = computed(() => mall.characters.value.find(item => String(item.characterEntityId || item.id) === selectedCharacterId.value) || null)
const owner = computed<MallCartOwner>(() => character.value ? 'together' : 'user')
const foods = computed(() => mall.state.products.filter(item => item.category === '吃喝' && item.source !== 'external'))
const foodCategories = ['全部', '正餐', '夜宵', '早餐', '饮料', '清淡']
const visibleFoods = computed(() => foods.value.filter(item => selectedCategory.value === '全部' || item.tags.includes(selectedCategory.value)))
const chosen = computed(() => mall.productMap.value.get(chosenId.value) || null)
const cart = computed(() => mall.ownerCart(owner.value).filter(item => item.product.category === '吃喝' && item.product.source !== 'external'))
const total = computed(() => cart.value.reduce((sum, item) => sum + item.product.priceCents * item.quantity, 0))
const wallet = computed(() => { void mall.state.updatedAt; return loadWalletState(mall.accountId.value, mall.currentAccount.value?.name || '我') })
const meituan = mallExternalPlatforms.find(item => item.id === 'meituan')!
const money = (value: number) => `¥${formatWalletMoney(value)}`
const notify = (text: string) => { toast.value = text; if (toastTimer) clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.value = '' }, 2200) }

const randomMeal = () => {
  const pool = visibleFoods.value.length ? visibleFoods.value : foods.value
  if (!pool.length) return
  chosenId.value = pool[Math.floor(Math.random() * pool.length)].id
}

const addFood = (product: MallProduct) => {
  mall.addToCart(product.id, owner.value); chosenId.value = product.id; notify(character.value ? `已放进和${character.value.name}的共同餐车` : '已加入餐车')
}

const checkout = () => {
  try {
    mall.checkout(owner.value, character.value ? { id: selectedCharacterId.value, name: character.value.name } : undefined, cart.value.map(item => item.productId))
    showCheckout.value = false; notify('剧情外卖已付款，可以去商城订单查看进度')
  } catch (error) { notify(error instanceof Error ? error.message : '下单失败') }
}

const requestExternal = () => {
  pendingUrl.value = query.value.trim() ? meituan.searchUrl(query.value.trim()) : meituan.homeUrl
  showExternal.value = true
}

const confirmExternal = () => {
  window.open(pendingUrl.value, '_blank', 'noopener,noreferrer'); showExternal.value = false
}
</script>

<template>
  <div class="takeout-app">
    <header><button aria-label="返回桌面" @click="emit('close')">‹</button><div><b>一起吃</b><small>今天也认真吃饭</small></div><button class="orders" @click="emit('open-mall')">订单</button></header>
    <main>
      <section class="meal-hero"><small>WHAT TO EAT</small><h1>{{character ? `和 ${character.name} 吃什么` : '今天吃什么'}}</h1><p>剧情外卖使用虚拟钱包；真实外卖会离开应用，在平台内完成付款。</p><div class="character-row"><button v-for="item in mall.characters.value" :key="item.id" :class="{active:String(item.characterEntityId||item.id)===selectedCharacterId}" @click="selectedCharacterId=String(item.characterEntityId||item.id)"><span :style="item.avatarUrl?{backgroundImage:`url(${item.avatarUrl})`}:{}">{{item.avatarUrl?'':item.avatarText}}</span><i>{{item.name}}</i></button><button v-if="selectedCharacterId" @click="selectedCharacterId=''" class="solo"><span>我</span><i>自己吃</i></button></div></section>

      <section class="decision-card"><div><small>选择困难时</small><h2>{{chosen?.title||'让今天替你选一次'}}</h2><p>{{chosen?.subtitle||'会从当前筛选的餐食里随机挑选。'}}</p></div><span>{{chosen?.emoji||'✦'}}</span><footer><button @click="randomMeal">随机选餐</button><button v-if="chosen" class="primary" @click="addFood(chosen)">就吃这个</button></footer></section>

      <div class="category-row"><button v-for="item in foodCategories" :key="item" :class="{active:selectedCategory===item}" @click="selectedCategory=item">{{item}}</button></div>
      <section class="food-list"><article v-for="product in visibleFoods" :key="product.id"><button class="food-main" @click="chosenId=product.id"><span>{{product.emoji}}</span><div><small>{{product.storeName}}</small><b>{{product.title}}</b><p>{{product.subtitle}}</p></div><strong>{{money(product.priceCents)}}</strong></button><button class="add" @click="addFood(product)">＋</button></article></section>

      <section class="real-panel"><div><i>团</i><span><b>去美团点真实外卖</b><small>搜索、登录、支付与配送均由美团负责</small></span></div><label><input v-model="query" maxlength="60" placeholder="火锅、奶茶、店铺名…" /><button @click="requestExternal">前往平台</button></label></section>
    </main>

    <section v-if="cart.length" class="cart-dock"><button @click="emit('open-mall')"><span>餐</span><div><small>{{cart.reduce((sum,item)=>sum+item.quantity,0)}} 件剧情餐食</small><b>{{money(total)}}</b></div></button><button @click="showCheckout=true">去结算</button></section>

    <div v-if="showCheckout||showExternal" class="overlay" @click.self="showCheckout=false;showExternal=false"><section class="confirm"><template v-if="showCheckout"><small>STORY ORDER</small><h2>确认剧情外卖</h2><p>将从剧情钱包扣除 {{money(total)}}，当前余额 {{money(wallet.cashCents)}}。</p><footer><button @click="showCheckout=false">取消</button><button class="primary" @click="checkout">确认支付</button></footer></template><template v-else><small>REAL PLATFORM</small><h2>前往美团</h2><p>即将离开本应用。实时商家、价格、配送、登录和真实付款全部以美团页面为准，虚拟钱包不会扣款。</p><footer><button @click="showExternal=false">取消</button><button class="primary" @click="confirmExternal">继续前往</button></footer></template></section></div>
    <Transition name="toast"><div v-if="toast" class="toast">{{toast}}</div></Transition>
  </div>
</template>

<style scoped>
.takeout-app{position:absolute;inset:0;z-index:1000;display:flex;flex-direction:column;overflow:hidden;background:#f5f2ec;color:#292722;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;-webkit-tap-highlight-color:transparent}.takeout-app>header{display:grid;height:55px;grid-template-columns:44px minmax(0,1fr) 44px;align-items:center;padding:calc(4px + env(safe-area-inset-top,0px)) 9px 0;box-sizing:border-box}.takeout-app>header button{height:34px;border:0;background:transparent;color:inherit;font:inherit;font-size:26px}.takeout-app>header .orders{font-size:10px}.takeout-app>header div{min-width:0;text-align:center}.takeout-app>header b,.takeout-app>header small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.takeout-app>header b{font:600 15px Georgia,"Songti SC",serif}.takeout-app>header small{color:#969087;font-size:8px}.takeout-app>main{min-height:0;flex:1;overflow:auto;padding:10px 12px calc(84px + env(safe-area-inset-bottom,0px))}.meal-hero{border-radius:17px;background:#d9c8b7;padding:19px 17px}.meal-hero>small,.decision-card small,.confirm>small{font-size:8px;letter-spacing:.18em}.meal-hero h1{margin:6px 0 4px;font:600 23px Georgia,"Songti SC",serif}.meal-hero>p{margin:0;color:#756a60;font-size:9px;line-height:1.55}.character-row{display:flex;gap:7px;overflow-x:auto;margin-top:15px;scrollbar-width:none}.character-row button{display:flex;width:48px;min-width:48px;align-items:center;flex-direction:column;gap:3px;border:0;background:transparent;color:#71685f;font:inherit}.character-row span{display:grid;width:35px;height:35px;place-items:center;border:2px solid transparent;border-radius:50%;background:#eee5dc;background-position:center;background-size:cover;font-size:10px}.character-row button.active span{border-color:#4a4038}.character-row i{max-width:48px;overflow:hidden;font-size:8px;font-style:normal;text-overflow:ellipsis;white-space:nowrap}.decision-card{display:grid;grid-template-columns:minmax(0,1fr) 54px;gap:9px;margin-top:10px;border-radius:15px;background:#2e2b27;padding:15px;color:#fff}.decision-card>div{min-width:0}.decision-card h2{margin:5px 0 3px;overflow:hidden;font:600 16px Georgia,"Songti SC",serif;text-overflow:ellipsis;white-space:nowrap}.decision-card p{margin:0;color:#bcb6ad;font-size:9px;line-height:1.5}.decision-card>span{display:grid;width:54px;height:54px;place-items:center;border-radius:13px;background:#45413b;font-size:28px}.decision-card footer{display:flex;grid-column:1/-1;gap:6px;margin-top:3px}.decision-card button,.confirm button{height:29px;border:1px solid #666058;border-radius:15px;background:transparent;padding:0 11px;color:#eee;font:inherit;font-size:9px}.decision-card button.primary,.confirm button.primary{border-color:#ede2d3;background:#ede2d3;color:#302c27}.category-row{display:flex;gap:5px;overflow:auto;margin:14px -12px 9px;padding:0 12px;scrollbar-width:none}.category-row button{height:25px;flex:none;border:1px solid #dad4cb;border-radius:13px;background:transparent;padding:0 11px;color:#827c73;font:inherit;font-size:9px}.category-row button.active{border-color:#36322e;background:#36322e;color:#fff}.food-list{display:grid;gap:7px}.food-list article{position:relative;border-radius:12px;background:#fff;padding:8px}.food-main{display:grid;width:calc(100% - 32px);min-width:0;grid-template-columns:45px minmax(0,1fr) auto;align-items:center;gap:8px;border:0;background:transparent;color:inherit;text-align:left}.food-main>span{display:grid;width:45px;height:45px;place-items:center;border-radius:10px;background:#eee7de;font-size:23px}.food-main>div{min-width:0}.food-main small,.food-main b,.food-main p{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.food-main small{color:#999289;font-size:8px}.food-main b{margin:2px 0;font-size:11px}.food-main p{margin:0;color:#8c857c;font-size:8px}.food-main strong{font:600 10px Georgia,serif}.food-list .add{position:absolute;right:8px;bottom:8px;display:grid;width:25px;height:25px;place-items:center;border:0;border-radius:50%;background:#38342f;color:#fff;font-size:14px}.real-panel{margin-top:13px;border:1px solid #ddd5ca;border-radius:13px;padding:11px}.real-panel>div{display:flex;align-items:center;gap:9px}.real-panel i{display:grid;width:31px;height:31px;place-items:center;border-radius:9px;background:#d2a918;color:#fff;font-size:11px;font-style:normal}.real-panel span{min-width:0}.real-panel b,.real-panel small{display:block}.real-panel b{font-size:11px}.real-panel small{margin-top:2px;color:#928b82;font-size:8px}.real-panel label{display:flex;gap:6px;margin-top:9px}.real-panel input{min-width:0;height:32px;flex:1;border:0;border-radius:8px;outline:0;background:#eae6df;padding:0 9px;font:inherit;font-size:9px}.real-panel label button{flex:none;border:0;border-radius:8px;background:#3a3631;padding:0 10px;color:#fff;font:inherit;font-size:9px}.cart-dock{position:absolute;right:10px;bottom:calc(9px + env(safe-area-inset-bottom,0px));left:10px;z-index:5;display:flex;height:54px;align-items:center;justify-content:space-between;border-radius:16px;background:#312e2a;padding:6px 7px 6px 10px;box-shadow:0 9px 28px rgba(0,0,0,.2);color:#fff}.cart-dock>button{display:flex;min-width:0;align-items:center;gap:8px;border:0;background:transparent;color:inherit;font:inherit;text-align:left}.cart-dock>button:first-child{flex:1}.cart-dock>button:first-child>span{display:grid;width:35px;height:35px;place-items:center;border-radius:50%;background:#48433d;font-size:12px}.cart-dock small,.cart-dock b{display:block}.cart-dock small{color:#aaa49b;font-size:8px}.cart-dock b{font:600 13px Georgia,serif}.cart-dock>button:last-child{height:34px;border-radius:17px;background:#eee3d4;padding:0 13px;color:#312d28;font-size:9px}.overlay{position:absolute;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;background:rgba(23,21,19,.38)}.confirm{box-sizing:border-box;width:calc(100% - 28px);max-width:380px;border-radius:16px;background:#f8f6f2;padding:17px}.confirm h2{margin:5px 0 7px;font:600 19px Georgia,"Songti SC",serif}.confirm p{color:#777168;font-size:10px;line-height:1.6}.confirm footer{display:flex;justify-content:flex-end;gap:6px;margin-top:12px}.confirm button{border-color:#d7d1c8;color:#5e5850}.confirm button.primary{border-color:#35312d;background:#35312d;color:#fff}.toast{position:absolute;right:18px;bottom:calc(74px + env(safe-area-inset-bottom,0px));left:18px;z-index:30;border-radius:10px;background:#37332f;padding:9px;color:#fff;font-size:10px;text-align:center}.toast-enter-active,.toast-leave-active{transition:.18s}.toast-enter-from,.toast-leave-to{transform:translateY(8px);opacity:0}.dark-theme .takeout-app{background:#191817;color:#eeeae4}.dark-theme .food-list article{background:#252321}.dark-theme .real-panel input{background:#2c2926;color:#eee}.dark-theme .confirm{background:#22201e}@media(max-width:340px){.takeout-app>main{padding-right:9px;padding-left:9px}.meal-hero{padding:16px 14px}.meal-hero h1{font-size:21px}.food-main{grid-template-columns:40px minmax(0,1fr)}.food-main>span{width:40px;height:40px}.food-main>strong{grid-column:2}.real-panel label{flex-direction:column}.real-panel label button{height:31px}}
.takeout-app>main{overflow-x:hidden;overflow-y:auto}.category-row{overflow-x:auto;overflow-y:hidden}.category-row::-webkit-scrollbar,.character-row::-webkit-scrollbar{display:none}
</style>
