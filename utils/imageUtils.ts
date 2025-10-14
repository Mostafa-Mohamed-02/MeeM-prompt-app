import { Mask } from '../types';

export const cropImage = (
  imageUrl: string,
  imageElement: HTMLImageElement,
  mask: Mask
): Promise<{ base64: string, mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const originalImage = new Image();
    originalImage.crossOrigin = "Anonymous";
    originalImage.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error("Could not get canvas context"));
      }
      
      const { naturalWidth, naturalHeight } = originalImage;
      const { clientWidth, clientHeight } = imageElement;
      
      if (clientWidth === 0 || clientHeight === 0) {
        return reject(new Error("Image element has zero dimensions. Cannot calculate crop scale."));
      }

      // Calculate the dimensions and offset of the 'object-contain' image
      const naturalRatio = naturalWidth / naturalHeight;
      const clientRatio = clientWidth / clientHeight;

      let renderedWidth, renderedHeight, offsetX, offsetY;

      if (naturalRatio > clientRatio) {
        // Image is wider than container, letterboxed top/bottom
        renderedWidth = clientWidth;
        renderedHeight = clientWidth / naturalRatio;
        offsetX = 0;
        offsetY = (clientHeight - renderedHeight) / 2;
      } else {
        // Image is taller than or equal to container, letterboxed left/right
        renderedHeight = clientHeight;
        renderedWidth = clientHeight * naturalRatio;
        offsetY = 0;
        offsetX = (clientWidth - renderedWidth) / 2;
      }

      // Translate mask coordinates from container-relative to image-relative
      const translatedMaskX = Math.max(0, mask.x - offsetX);
      const translatedMaskY = Math.max(0, mask.y - offsetY);

      // Determine the single scale factor for the contained image
      const scale = naturalWidth / renderedWidth;
      
      // Convert the translated mask coordinates to the source image's dimensions
      const sourceX = translatedMaskX * scale;
      const sourceY = translatedMaskY * scale;
      const sourceWidth = mask.width * scale;
      const sourceHeight = mask.height * scale;
      
      canvas.width = sourceWidth;
      canvas.height = sourceHeight;

      ctx.drawImage(
        originalImage,
        sourceX, sourceY,
        sourceWidth, sourceHeight,
        0, 0,
        sourceWidth, sourceHeight
      );

      const dataUrl = canvas.toDataURL('image/png');
      const base64 = dataUrl.split(',')[1];
      resolve({ base64, mimeType: 'image/png' });
    };
    originalImage.onerror = (err) => reject(err);
    originalImage.src = imageUrl;
  });
};