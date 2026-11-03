/** Pinned official ONNX and WASM assets; executable runtime is SHA-256 verified before loading. */
export const EMBEDDING_MANIFEST={
  "id": "bge-small-zh-v1.5-q8-wasm-v1",
  "modelRevision": "75c43b069aac4d136ba6bc1122f995fedcfd2781",
  "runtimeVersion": "3.8.1",
  "dimensions": 512,
  "files": [
    {
      "path": "runtime/transformers.min.js",
      "url": "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js",
      "bytes": 888173,
      "sha256": "aa5002b70e789798da263f5f99c62bd3e8fcd0c119258a493c40c180648365fa"
    },
    {
      "path": "runtime/ort-wasm-simd-threaded.jsep.mjs",
      "url": "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/ort-wasm-simd-threaded.jsep.mjs",
      "bytes": 44484,
      "sha256": "08fb86ec433c78bfb032c5d84a68b8e8e5a8d81268fa39e24314179a5767a5b9"
    },
    {
      "path": "runtime/ort-wasm-simd-threaded.jsep.wasm",
      "url": "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/ort-wasm-simd-threaded.jsep.wasm",
      "bytes": 21596019,
      "sha256": "c46655e8a94afc45338d4cb2b840475f88e5012d524509916e505079c00bfa39"
    },
    {
      "path": "models/bge-small-zh/config.json",
      "url": "https://huggingface.co/Xenova/bge-small-zh-v1.5/resolve/75c43b069aac4d136ba6bc1122f995fedcfd2781/config.json?download=true",
      "bytes": 716,
      "sha256": "d4193ead3a810fd694fa8a31d7fc72fbaebc0668b603e398734bf2f6538ff42f"
    },
    {
      "path": "models/bge-small-zh/tokenizer.json",
      "url": "https://huggingface.co/Xenova/bge-small-zh-v1.5/resolve/75c43b069aac4d136ba6bc1122f995fedcfd2781/tokenizer.json?download=true",
      "bytes": 439125,
      "sha256": "48cea5d44424912a6fd1ea647bf4fe50b55ab8b1e5879c3275f80e339e8fae26"
    },
    {
      "path": "models/bge-small-zh/tokenizer_config.json",
      "url": "https://huggingface.co/Xenova/bge-small-zh-v1.5/resolve/75c43b069aac4d136ba6bc1122f995fedcfd2781/tokenizer_config.json?download=true",
      "bytes": 367,
      "sha256": "e6f3b96db926a37d4039995fbf5ad17de158dfb8f6343d607e4dbaad18d75f5a"
    },
    {
      "path": "models/bge-small-zh/special_tokens_map.json",
      "url": "https://huggingface.co/Xenova/bge-small-zh-v1.5/resolve/75c43b069aac4d136ba6bc1122f995fedcfd2781/special_tokens_map.json?download=true",
      "bytes": 125,
      "sha256": "b6d346be366a7d1d48332dbc9fdf3bf8960b5d879522b7799ddba59e76237ee3"
    },
    {
      "path": "models/bge-small-zh/onnx/model_quantized.onnx",
      "url": "https://huggingface.co/Xenova/bge-small-zh-v1.5/resolve/75c43b069aac4d136ba6bc1122f995fedcfd2781/onnx/model_quantized.onnx?download=true",
      "bytes": 24010842,
      "sha256": "15b717c382bcb518ba457b93ea6850ede7f4f1cd8937454aa06972366cd19bcc"
    }
  ]
} as const
