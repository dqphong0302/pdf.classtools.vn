declare module '@jspawn/qpdf-wasm' {
  interface QpdfWasmModule {
    FS: {
      writeFile(path: string, data: Uint8Array): void;
      readFile(path: string): Uint8Array;
      unlink(path: string): void;
    };
    callMain(args: string[]): number;
  }

  const createQpdfModule: (options?: { locateFile?: (path: string) => string }) => Promise<QpdfWasmModule>;
  export default createQpdfModule;
}
