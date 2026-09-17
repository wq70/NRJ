/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
import JSZip from 'jszip'
import type { TextGameAsset, TextGameProject } from '../types/textGame'
import { getTextGameAssetBlob } from './textGameRepository'

const PACKAGE_FORMAT = 'nrj-text-game'

export const createTextGamePackage = async (project: TextGameProject, assets: TextGameAsset[]) => {
  const zip = new JSZip()
  zip.file('manifest.json', JSON.stringify({ format: PACKAGE_FORMAT, version: 1, exportedAt: Date.now(), title: project.title }, null, 2))
  zip.file('project.json', JSON.stringify(project, null, 2))
  zip.file('assets.json', JSON.stringify(assets, null, 2))
  for (const asset of assets) {
    const blob = await getTextGameAssetBlob(asset.id)
    if (blob) zip.file(`assets/${asset.id}`, blob)
  }
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
}

export const readTextGamePackage = async (file: File) => {
  const zip = await JSZip.loadAsync(file)
  const manifest = JSON.parse(await zip.file('manifest.json')?.async('string') || '{}')
  if (manifest.format !== PACKAGE_FORMAT || manifest.version !== 1) throw new Error('不是可识别的文游作品包')
  const project = JSON.parse(await zip.file('project.json')?.async('string') || '{}') as TextGameProject
  if (!project.id || !Array.isArray(project.nodes)) throw new Error('作品包缺少有效剧情数据')
  const assets = JSON.parse(await zip.file('assets.json')?.async('string') || '[]') as TextGameAsset[]
  const files: Array<{ asset: TextGameAsset; blob: Blob }> = []
  for (const asset of assets) {
    const entry = zip.file(`assets/${asset.id}`)
    if (entry) files.push({ asset, blob: await entry.async('blob') })
  }
  return { project, files }
}
