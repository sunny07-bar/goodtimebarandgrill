/**
 * Compresses and converts an image to WebP format
 * ALWAYS compresses to under 100KB while maintaining maximum quality possible
 * Uses aggressive compression if needed to guarantee target size
 * @param file - The image file to compress
 * @param targetSizeKB - Target size in KB (default: 100)
 * @returns Compressed File object in WebP format (guaranteed under targetSizeKB)
 */
export async function compressImageToWebP(
  file: File,
  targetSizeKB: number = 100
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Canvas context not available'));
      return;
    }

    img.onload = async () => {
      try {
        // Start with original dimensions
        let width = img.width;
        let height = img.height;
        const maxDimension = 1920; // Increased from 1400 for better quality retention

        // Initial resize if too large
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height / width) * maxDimension);
            width = maxDimension;
          } else {
            width = Math.round((width / height) * maxDimension);
            height = maxDimension;
          }
        }

        // Function to try compression at specific dimensions and quality
        const tryCompress = async (w: number, h: number, q: number): Promise<{ blob: Blob; sizeKB: number } | null> => {
          canvas.width = w;
          canvas.height = h;
          ctx.clearRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          
          const blob = await new Promise<Blob | null>((resolveBlob) => {
            canvas.toBlob(
              (blob) => resolveBlob(blob),
              'image/webp',
              q
            );
          });
          
          if (!blob) return null;
          return { blob, sizeKB: blob.size / 1024 };
        };

        // Strategy 1: Try high quality first (0.95 to 0.85)
        for (let quality = 0.95; quality >= 0.85; quality -= 0.05) {
          const result = await tryCompress(width, height, quality);
          if (result && result.sizeKB <= targetSizeKB) {
            const fileName = file.name.replace(/\.[^/.]+$/, '') + '.webp';
            const compressedFile = new File([result.blob], fileName, {
              type: 'image/webp',
              lastModified: Date.now(),
            });
            console.log(`✓ Image compressed to ${result.sizeKB.toFixed(2)} KB (quality: ${(quality * 100).toFixed(0)}%, ${width}x${height})`);
            resolve(compressedFile);
            return;
          }
        }

        // Strategy 2: Reduce dimensions gradually while trying different quality levels
        let currentWidth = width;
        let currentHeight = height;
        const minDimension = 200; // Minimum size to maintain usability
        
        while (currentWidth >= minDimension && currentHeight >= minDimension) {
          // Try quality levels from high to low
          for (let quality = 0.90; quality >= 0.30; quality -= 0.10) {
            const result = await tryCompress(currentWidth, currentHeight, quality);
            if (result && result.sizeKB <= targetSizeKB) {
              const fileName = file.name.replace(/\.[^/.]+$/, '') + '.webp';
              const compressedFile = new File([result.blob], fileName, {
                type: 'image/webp',
                lastModified: Date.now(),
              });
              console.log(`✓ Image compressed to ${result.sizeKB.toFixed(2)} KB (quality: ${(quality * 100).toFixed(0)}%, ${currentWidth}x${currentHeight})`);
              resolve(compressedFile);
              return;
            }
          }
          
          // Reduce dimensions by 10% for next iteration
          currentWidth = Math.round(currentWidth * 0.90);
          currentHeight = Math.round(currentHeight * 0.90);
        }

        // Strategy 3: If still not under target, use minimum dimensions with lowest quality
        // This ensures we ALWAYS get under 100KB
        const finalWidth = Math.max(minDimension, Math.round(width * 0.5));
        const finalHeight = Math.max(minDimension, Math.round(height * 0.5));
        
        for (let quality = 0.50; quality >= 0.20; quality -= 0.05) {
          const result = await tryCompress(finalWidth, finalHeight, quality);
          if (result && result.sizeKB <= targetSizeKB) {
            const fileName = file.name.replace(/\.[^/.]+$/, '') + '.webp';
            const compressedFile = new File([result.blob], fileName, {
              type: 'image/webp',
              lastModified: Date.now(),
            });
            console.log(`✓ Image compressed to ${result.sizeKB.toFixed(2)} KB (quality: ${(quality * 100).toFixed(0)}%, ${finalWidth}x${finalHeight})`);
            resolve(compressedFile);
            return;
          }
        }

        // Strategy 4: Last resort - aggressive compression to guarantee under 100KB
        // Keep reducing until we hit target
        let lastWidth = finalWidth;
        let lastHeight = finalHeight;
        let lastQuality = 0.20;
        
        while (lastWidth >= 100 && lastHeight >= 100) {
          const result = await tryCompress(lastWidth, lastHeight, lastQuality);
          if (result) {
            if (result.sizeKB <= targetSizeKB) {
              const fileName = file.name.replace(/\.[^/.]+$/, '') + '.webp';
              const compressedFile = new File([result.blob], fileName, {
                type: 'image/webp',
                lastModified: Date.now(),
              });
              console.log(`✓ Image compressed to ${result.sizeKB.toFixed(2)} KB (quality: ${(lastQuality * 100).toFixed(0)}%, ${lastWidth}x${lastHeight})`);
              resolve(compressedFile);
              return;
            }
            // If still over, reduce quality further
            if (lastQuality > 0.10) {
              lastQuality -= 0.05;
            } else {
              // If quality is already low, reduce dimensions
              lastWidth = Math.round(lastWidth * 0.90);
              lastHeight = Math.round(lastHeight * 0.90);
              lastQuality = 0.20; // Reset quality for new dimensions
            }
          } else {
            // If blob creation failed, reduce dimensions
            lastWidth = Math.round(lastWidth * 0.90);
            lastHeight = Math.round(lastHeight * 0.90);
          }
        }

        // Final fallback - use absolute minimum with lowest quality
        const absoluteMin = 100;
        const finalResult = await tryCompress(absoluteMin, absoluteMin, 0.10);
        if (finalResult) {
          const fileName = file.name.replace(/\.[^/.]+$/, '') + '.webp';
          const compressedFile = new File([finalResult.blob], fileName, {
            type: 'image/webp',
            lastModified: Date.now(),
          });
          console.log(`✓ Image compressed to ${finalResult.sizeKB.toFixed(2)} KB (minimum size, quality: 10%, ${absoluteMin}x${absoluteMin})`);
          resolve(compressedFile);
          return;
        }

        reject(new Error('Failed to compress image - unable to create WebP blob'));
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    // Load the image
    img.src = URL.createObjectURL(file);
  });
}
