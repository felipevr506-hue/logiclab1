"use client";

import Editor, { loader } from "@monaco-editor/react";

// Os arquivos AMD e workers são servidos pelo próprio aplicativo a partir de
// public/monaco. Assim o editor não depende de CDN ou de acesso à internet.
// Blob workers need an absolute base URL to resolve the TypeScript worker.
// Keep all requests on this application's origin, without a CDN dependency.
if (typeof window !== "undefined") {
  loader.config({
    paths: { vs: new URL("/monaco/vs", window.location.origin).href },
  });
}

export default Editor;
