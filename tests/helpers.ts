import { PNG } from "pngjs";

export function pngBytes(width = 120, height = 120) {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (width * y + x) << 2;
      png.data[index] = 33;
      png.data[index + 1] = 108;
      png.data[index + 2] = 95;
      png.data[index + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

