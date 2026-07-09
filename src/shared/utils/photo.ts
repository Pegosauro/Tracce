export const compressPhoto = (file: File, maxSize = 1440, quality = 0.72) =>
  new Promise<{ blob: Blob; width: number; height: number; mimeType: string; sizeBytes: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const ratio = Math.min(1, maxSize / Math.max(image.width, image.height));
      const width = Math.round(image.width * ratio);
      const height = Math.round(image.height * ratio);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Compressione foto non disponibile.'));
        return;
      }
      ctx.drawImage(image, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) reject(new Error('Compressione foto non riuscita.'));
          else resolve({ blob, width, height, mimeType: blob.type, sizeBytes: blob.size });
        },
        'image/webp',
        quality,
      );
    };
    image.onerror = () => reject(new Error('Foto non leggibile.'));
    image.src = URL.createObjectURL(file);
  });
