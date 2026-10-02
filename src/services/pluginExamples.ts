import { bytesToBase64 } from './pluginPackage'
import type { PluginPackage } from '../types/plugins'

const exampleStyle = `<style>body{max-width:560px;margin:auto;line-height:1.6}h1{font-size:18px;margin:0 0 6px}p{font-size:12px;opacity:.75}textarea{width:100%;min-height:220px;resize:vertical;margin:12px 0}button{margin:0 6px 8px 0}#status{font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere}</style>`
export const createPluginExample = (kind: 'notes' | 'chat'): PluginPackage => {
  const notes = kind === 'notes'
  const manifest: PluginPackage['manifest'] = {
    format: 'nrj-plugin', apiVersion: 1, id: notes ? 'example.notes' : 'example.chat-tools',
    name: notes ? '随手记' : '聊天小工具', version: '1.0.0', description: notes ? '独立 APP 示例：记录文字，关闭后仍会保存。' : '聊天扩展示例：读取文字消息、导出对话、向输入框添加草稿。',
    entry: 'index.html', app: notes, extensions: notes ? [] : [{ target: 'chat', label: '聊天小工具' }], permissions: notes ? [] : ['chat.read', 'chat.draft', 'files.download']
  }
  const content = notes
    ? `<h1>随手记</h1><p>这是你安装的独立 APP。内容只保存在这个插件自己的空间。</p><textarea id="note" aria-label="笔记内容" placeholder="写下你的想法…"></textarea><button id="save">保存笔记</button><div id="status" role="status"></div><script>
const note=document.getElementById('note'),status=document.getElementById('status');
nrj.storage.get('note').then(value=>{note.value=typeof value==='string'?value:''}).catch(error=>status.textContent=error.message);
document.getElementById('save').onclick=async()=>{try{await nrj.storage.set('note',note.value);status.textContent='笔记已保存，下次打开仍可继续使用。'}catch(error){status.textContent=error.message}};
</script>`
    : `<h1>聊天小工具</h1><p>请在插件管理中开启所需权限。草稿只添加到输入框，发送由你决定。</p><button id="read">读取对话</button><button id="export">导出文字</button><textarea id="draft" aria-label="草稿文字" placeholder="输入想添加到聊天输入框的文字…"></textarea><button id="insert">添加草稿</button><div id="status" role="status"></div><script>
const status=document.getElementById('status');
async function readAll(){let offset=0,text='',page;do{page=await nrj.chat.getMessages({offset,limit:200});text+=page.messages.map(m=>m.sender+'：'+m.text).join('\\n')+'\\n';offset+=page.messages.length;if(text.length>1900000)throw new Error('对话过长，请分段导出');}while(page.hasMore&&page.messages.length);return{text,name:page.name,total:page.total}}
document.getElementById('read').onclick=async()=>{try{const data=await readAll();status.textContent='共 '+data.total+' 条消息\\n'+data.text}catch(error){status.textContent=error.message}};
document.getElementById('export').onclick=async()=>{try{const data=await readAll();await nrj.files.download('聊天记录.txt',data.text);status.textContent='导出请求已完成。'}catch(error){status.textContent=error.message}};
document.getElementById('insert').onclick=async()=>{try{await nrj.chat.insertText(document.getElementById('draft').value);status.textContent='已添加到输入框，返回聊天后可查看并发送。'}catch(error){status.textContent=error.message}};
</script>`
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8">${exampleStyle}</head><body>${content}</body></html>`
  return { manifest, files: { 'index.html': { mime: 'text/html', base64: bytesToBase64(new TextEncoder().encode(html)) } } }
}
