export function clipboardImageFile(clipboardData) {
  const item = [...(clipboardData?.items ?? [])].find(entry => entry.kind === 'file' && entry.type.startsWith('image/'))
  return item?.getAsFile?.() ?? null
}

export async function decodeImageBlob(blob) {
  const bitmap = await createImageBitmap(blob)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    context.drawImage(bitmap, 0, 0)
    return context.getImageData(0, 0, bitmap.width, bitmap.height)
  } finally {
    bitmap.close?.()
  }
}

export async function imageBlobDimensions(blob) {
  const bitmap = await createImageBitmap(blob)
  try {
    return { width: bitmap.width, height: bitmap.height }
  } finally {
    bitmap.close?.()
  }
}

export async function readClipboardImage() {
  if (!navigator.clipboard?.read) return null
  const items = await navigator.clipboard.read()
  for (const item of items) {
    const type = item.types.find(value => value.startsWith('image/'))
    if (type) return item.getType(type)
  }
  return null
}

export function quantizeClipboardImage(imageData, palette, colors) {
  const pixels = []
  const paletteRgb = palette.map(colorIndex => {
    const hex = colors[colorIndex] ?? '#000000'
    return [1, 3, 5].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16))
  })
  for (let index = 0; index < imageData.data.length; index += 4) {
    if (imageData.data[index + 3] < 128) {
      pixels.push(-1)
      continue
    }
    const red = imageData.data[index]
    const green = imageData.data[index + 1]
    const blue = imageData.data[index + 2]
    let nearest = 0
    let nearestDistance = Number.POSITIVE_INFINITY
    for (let ink = 0; ink < paletteRgb.length; ink++) {
      const [pr, pg, pb] = paletteRgb[ink]
      const distance = (red - pr) ** 2 + (green - pg) ** 2 + (blue - pb) ** 2
      if (distance < nearestDistance) {
        nearest = ink
        nearestDistance = distance
      }
    }
    pixels.push(nearest)
  }
  return { w: imageData.width, h: imageData.height, pixels, palette: [...palette] }
}

export function positionClipboardOverCanvas(cell, clipboardWidth, clipboardHeight, canvasWidth, canvasHeight) {
  if (!cell) return cell
  const offsetX = Math.round(cell.x * (clipboardWidth - canvasWidth) / Math.max(1, canvasWidth - 1))
  const offsetY = Math.round(cell.y * (clipboardHeight - canvasHeight) / Math.max(1, canvasHeight - 1))
  return {
    x: clipboardWidth > canvasWidth ? (-offsetX || 0) : cell.x,
    y: clipboardHeight > canvasHeight ? (-offsetY || 0) : cell.y,
  }
}
