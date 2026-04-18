import { Area } from 'react-easy-crop';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (err) => reject(err));
    image.src = src;
  });
}

/** Обрезка по `croppedAreaPixels` (из react-easy-crop) и масштаб до квадрата `outputSize`. */
export async function getCroppedImageBlob(
  imageSrc: string,
  pixelCrop: Area,
  outputSize: number,
  mimeType: string = 'image/jpeg',
  quality?: number
): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D недоступен');
  }
  canvas.width = outputSize;
  canvas.height = outputSize;
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outputSize,
    outputSize
  );
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Не удалось сформировать изображение'));
      },
      mimeType,
      quality ?? 0.92
    );
  });
}
