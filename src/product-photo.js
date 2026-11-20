export async function compressPhoto(source) {
  const photo = new Image();
  photo.src = source;
  await photo.decode();
  const longest = Math.max(photo.naturalWidth, photo.naturalHeight);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { alpha: false });
  if (!longest || !context) throw new Error('Cannot decode photo');

  // Limit canvas size on phones and pad unusually narrow images for Telegram.
  for (const maxSide of [1280, 960, 720, 480]) {
    const scale = Math.min(1, maxSide / longest);
    const width = Math.max(1, Math.round(photo.naturalWidth * scale));
    const height = Math.max(1, Math.round(photo.naturalHeight * scale));
    const minSide = Math.ceil(Math.max(width, height) / 18);
    canvas.width = Math.max(minSide, width);
    canvas.height = Math.max(minSide, height);
    context.fillStyle = '#171717';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(photo, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
    for (const quality of [0.84, 0.72]) {
      const jpeg = canvas.toDataURL('image/jpeg', quality);
      if (jpeg.startsWith('data:image/jpeg;base64,') && jpeg.length <= 400_000) return jpeg;
    }
  }
  throw new Error('Cannot compress photo');
}

export async function compressUpload(file) {
  const source = URL.createObjectURL(file);
  try {
    return await compressPhoto(source);
  } finally {
    URL.revokeObjectURL(source);
  }
}
