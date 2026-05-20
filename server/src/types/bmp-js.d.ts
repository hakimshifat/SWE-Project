declare module "bmp-js" {
  export interface DecodedBmp {
    width: number;
    height: number;
    data: Buffer;
  }

  export function decode(buffer: Buffer): DecodedBmp;
}

