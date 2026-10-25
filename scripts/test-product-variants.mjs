import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'

const source = await readFile('src/lib/productVariants.ts', 'utf8')
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } })
const { prepareProductVariants } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
const shade = (id = 'noir-id', value = 'Noir Intense', stock = 4) => ({ id, name: 'Teinte', value, stock })

test('modifier le stock conserve le meme identifiant de teinte', () => {
  const result = prepareProductVariants('product', [shade(undefined, 'Noir Intense', 3)], [shade()], () => 'new-id')
  assert.equal(result.rows[0].id, 'noir-id')
  assert.equal(result.rows[0].stock, 3)
  assert.deepEqual(result.removedIds, [])
})

test('renommer une teinte conserve son identifiant et les liens des commandes', () => {
  const result = prepareProductVariants('product', [shade('noir-id', 'Noir profond')], [shade()])
  assert.equal(result.rows[0].id, 'noir-id')
  assert.deepEqual(result.removedIds, [])
})

test('un ancien formulaire retrouve une teinte par son nom unique', () => {
  const result = prepareProductVariants('product', [shade('obsolete-id', '  noir intense  ')], [shade()], () => 'new-id')
  assert.equal(result.rows[0].id, 'noir-id')
  assert.equal(result.rows[0].value, 'noir intense')
})

test('seules les teintes reellement supprimees sont retirees', () => {
  const result = prepareProductVariants('product', [shade()], [shade(), shade('bleu-id', 'Bleu', 0)])
  assert.deepEqual(result.removedIds, ['bleu-id'])
})

test('ajouter une teinte cree un nouvel identifiant sans remplacer les autres', () => {
  const result = prepareProductVariants('product', [shade(), { name: 'Teinte', value: 'Bleu', stock: 2 }], [shade()], () => 'new-id')
  assert.deepEqual(result.rows.map((item) => item.id), ['noir-id', 'new-id'])
  assert.deepEqual(result.removedIds, [])
})

test('les noms vides ou dupliques sont refuses avant toute suppression', () => {
  assert.throws(() => prepareProductVariants('product', [shade(), shade('other', ' NOIR INTENSE ')], [shade()]), /nom unique/)
  assert.throws(() => prepareProductVariants('product', [shade('other', ' ')], [shade()]), /nom unique/)
})
