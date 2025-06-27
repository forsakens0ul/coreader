// 为需要的模块添加类型声明
declare module 'iconv-lite' {
  export function decode(buffer: Buffer | Uint8Array, encoding: string): string;
} 