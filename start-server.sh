#!/bin/bash

# 编译 TypeScript 文件
npx tsc server/*.ts --outDir dist --module esnext --target es2020 --esModuleInterop --skipLibCheck --moduleResolution bundler

# 使用 nodemon 监听文件变化
npx nodemon --watch server --ext ts --exec "npx tsc server/*.ts --outDir dist --module esnext --target es2020 --esModuleInterop --skipLibCheck --moduleResolution bundler && node dist/server/index.js"
