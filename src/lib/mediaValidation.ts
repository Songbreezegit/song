export function imageSignature(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) return 'image/png';
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'image/webp';
  return null;
}

export async function validateMediaImage(file: File): Promise<void> {
  const actual = imageSignature(new Uint8Array(await file.slice(0, 12).arrayBuffer()));
  const expectedExtension = file.name.split('.').pop()?.toLowerCase();
  const expectedType = expectedExtension === 'jpg' || expectedExtension === 'jpeg' ? 'image/jpeg' : `image/${expectedExtension}`;
  if (!actual || actual !== file.type || actual !== expectedType) throw new Error('图片内容与文件格式不一致，请选择有效的 JPG、PNG 或 WEBP 图片。');
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw new Error('图片无法解码，请重新导出后上传。'); }
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 40000000) throw new Error('图片尺寸过大，最多支持 4000 万像素。');
  } finally { bitmap.close(); }
}
