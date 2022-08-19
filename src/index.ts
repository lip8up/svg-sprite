import fg from 'fast-glob'
import fs from 'fs-extra'
import { extname } from 'pathe'
import { optimize, OptimizedSvg, OptimizeOptions } from 'svgo'
import normalizePath from 'normalize-path'
// @ts-ignore
import SVGCompiler from 'svg-baker-update'

export interface FileStats {
  relativeName: string
  mtimeMs?: number
  code: string
  symbolId?: string
}

export interface ScanDirOptions {
  /**
   * icon format
   * @default: icon-[dir]-[name]
   */
  symbolId?: string

  /**
   * svgo configuration, used to compress svg
   * @default：true
   */
  svgoOptions?: boolean | OptimizeOptions
}

const XMLNS = 'http://www.w3.org/2000/svg'
const XMLNS_LINK = 'http://www.w3.org/1999/xlink'

export const scanDir = async (iconDir: string, cache: Map<string, FileStats>, options?: ScanDirOptions) => {
  const { svgoOptions, symbolId } = {
    symbolId: 'icon-[dir]-[name]',
    svgoOptions: true,
    ...options
  }
  const { insertHtml, idSet } = await compilerIcons(
    cache,
    iconDir,
    symbolId,
    typeof svgoOptions === 'boolean' ? {} : svgoOptions
  )

  const xmlns = `xmlns="${XMLNS}"`
  const xmlnsLink = `xmlns:xlink="${XMLNS_LINK}"`
  const html = insertHtml.replace(new RegExp(xmlns, 'g'), '').replace(new RegExp(xmlnsLink, 'g'), '')

  // @prettier-ignore
  const svgHtml = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:link="http://www.w3.org/1999/xlink">${html}</svg>`
  return { svgHtml, html, idSet }
}

const compilerIcons = async (
  cache: Map<string, FileStats>,
  iconDir: string,
  symbolIdTemplate: string,
  svgoOptions: OptimizeOptions
) => {
  let insertHtml = ''
  const idSet = new Set<string>()

  const svgFilsStats = fg.sync('**/*.svg', {
    cwd: iconDir,
    stats: true,
    absolute: true
  })

  for (const entry of svgFilsStats) {
    const { path, stats: { mtimeMs } = {} } = entry
    const cacheStat = cache.get(path)
    let symbolId = ''
    let svgSymbol
    let relativeName = ''

    const getSymbol = async () => {
      relativeName = normalizePath(path).replace(normalizePath(iconDir) + '/', '')
      symbolId = createSymbolId(relativeName, symbolIdTemplate)
      svgSymbol = await compilerIcon(path, symbolId, svgoOptions)
      idSet.add(symbolId)
    }

    if (cacheStat) {
      if (cacheStat.mtimeMs !== mtimeMs) {
        await getSymbol()
      } else {
        svgSymbol = cacheStat.code
        symbolId = cacheStat.symbolId ?? ''
        symbolId && idSet.add(symbolId)
      }
    } else {
      await getSymbol()
    }

    svgSymbol &&
      cache.set(path, {
        mtimeMs,
        relativeName,
        code: svgSymbol,
        symbolId
      })
    insertHtml += `${svgSymbol || ''}`
  }
  return { insertHtml, idSet }
}

const compilerIcon = async (file: string, symbolId: string, svgoOptions: OptimizeOptions): Promise<string | null> => {
  if (!file) {
    return null
  }

  let content = fs.readFileSync(file, 'utf-8')

  const { data } = (await optimize(content, svgoOptions)) as OptimizedSvg
  content = data || content

  // fix cannot change svg color by parent node problem
  content = content.replace(/stroke="[a-zA-Z#0-9]*"/, 'stroke="currentColor"')
  const svgSymbol = await new SVGCompiler().addSymbol({
    id: symbolId,
    content,
    path: file
  })
  return svgSymbol.render()
}

const createSymbolId = (name: string, symbolId: string) => {
  let id = symbolId
  let fName = name

  const { fileName = '', dirName } = discreteDir(name)
  if (symbolId.includes('[dir]')) {
    id = id.replace(/\[dir\]/g, dirName)
    if (!dirName) {
      id = id.replace('--', '-')
    }
    fName = fileName
  }
  id = id.replace(/\[name\]/g, fName)
  return id.replace(extname(id), '')
}

const discreteDir = (name: string) => {
  if (!normalizePath(name).includes('/')) {
    return {
      fileName: name,
      dirName: ''
    }
  }
  const strList = name.split('/')
  const fileName = strList.pop()
  const dirName = strList.join('-')
  return { fileName, dirName }
}
