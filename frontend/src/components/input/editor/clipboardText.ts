import type {Fragment, Node as PMNode, Slice} from '@tiptap/pm/model'

// Plain-text clipboard serializer that keeps the structure of lists (bullet,
// ordered and task lists) as markdown-like markers instead of dropping them.

function inlineText(node: PMNode): string {
	return node.textBetween(0, node.content.size, '\n', leaf => {
		if (leaf.type.name === 'hardBreak') {
			return '\n'
		}
		const leafText = leaf.type.spec.leafText
		if (leafText) {
			return leafText(leaf)
		}
		return leaf.isText ? (leaf.text ?? '') : ''
	})
}

function indentLines(text: string, indent: string): string {
	return text.split('\n').map((line, i) => (i === 0 || line === '' ? line : indent + line)).join('\n')
}

function serializeListItem(item: PMNode, marker: string): string {
	const body = serializeBlocks(item.content)
	return marker + indentLines(body, ' '.repeat(marker.length))
}

function serializeList(list: PMNode): string {
	const lines: string[] = []
	const isOrdered = list.type.name === 'orderedList'
	let number = typeof list.attrs.start === 'number' ? list.attrs.start : 1

	list.forEach(item => {
		let marker = '- '
		if (isOrdered) {
			marker = `${number}. `
			number++
		} else if (item.type.name === 'taskItem') {
			marker = item.attrs.checked ? '- [x] ' : '- [ ] '
		}
		lines.push(serializeListItem(item, marker))
	})

	return lines.join('\n')
}

function serializeBlock(node: PMNode): string {
	switch (node.type.name) {
		case 'bulletList':
		case 'orderedList':
		case 'taskList':
			return serializeList(node)
		case 'listItem':
			return serializeListItem(node, '- ')
		case 'taskItem':
			return serializeListItem(node, node.attrs.checked ? '- [x] ' : '- [ ] ')
		case 'blockquote':
			return serializeBlocks(node.content).split('\n').map(line => '> ' + line).join('\n')
		default:
			break
	}

	if (node.isTextblock) {
		return inlineText(node)
	}
	if (node.isLeaf) {
		return node.type.spec.leafText ? node.type.spec.leafText(node) : (node.isText ? (node.text ?? '') : '')
	}
	if (node.isInline) {
		return inlineText(node)
	}
	return serializeBlocks(node.content)
}

function serializeBlocks(fragment: Fragment): string {
	const parts: string[] = []
	let inline = ''
	let hasInline = false

	fragment.forEach(child => {
		if (child.isInline) {
			hasInline = true
			if (child.isText) {
				inline += child.text ?? ''
			} else if (child.type.name === 'hardBreak') {
				inline += '\n'
			} else {
				inline += child.type.spec.leafText ? child.type.spec.leafText(child) : child.textContent
			}
			return
		}
		if (hasInline) {
			parts.push(inline)
			inline = ''
			hasInline = false
		}
		parts.push(serializeBlock(child))
	})

	if (hasInline) {
		parts.push(inline)
	}

	return parts.join('\n')
}

export function serializeClipboardText(slice: Slice): string {
	return serializeBlocks(slice.content)
}
