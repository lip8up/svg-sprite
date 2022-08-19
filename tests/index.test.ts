import { resolve } from 'pathe'
import { scanDir } from '../src'

test('scanDir', async () => {
  const iconDir = resolve(process.cwd(), 'tests/icons')
  const { svgHtml, html, idSet } = await scanDir(iconDir)

  expect(/id="icon-add"/.test(svgHtml)).toBeTruthy()
  expect(/id="icon-inner-talk"/.test(svgHtml)).toBeTruthy()
  expect(/id="icon-qrcode"/.test(svgHtml)).toBeTruthy()

  expect(/id="icon-add"/.test(html)).toBeTruthy()
  expect(/id="icon-inner-talk"/.test(html)).toBeTruthy()
  expect(/id="icon-qrcode"/.test(html)).toBeTruthy()

  expect(Array.from(idSet).sort()).toEqual(['icon-add', 'icon-inner-talk', 'icon-qrcode'])
})
