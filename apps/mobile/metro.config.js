const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo (append to defaults)
config.watchFolders = [...(config.watchFolders || []), workspaceRoot];

// 2. Let Metro look in the project's node_modules and then the monorepo's node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// 3. Force Metro to resolve modules from the node_modules listed above
config.resolver.disableHierarchicalLookup = false;

// 4. Polyfill Node.js core modules for libraries like 'ws' used by Supabase
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  stream: require.resolve("stream-browserify"),
  buffer: require.resolve("buffer"),
  process: require.resolve("process/browser"),
  zlib: require.resolve("browserify-zlib"),
  util: require.resolve("util"),
  crypto: require.resolve("crypto-browserify"),
  events: require.resolve("events"),
  http: require.resolve("http-browserify"),
  https: require.resolve("https-browserify"),
  os: require.resolve("os-browserify/browser"),
  path: require.resolve("path-browserify"),
  url: require.resolve("url"),
  assert: require.resolve("assert/"),
  net: path.resolve(__dirname, "empty-module.js"),
  tls: path.resolve(__dirname, "empty-module.js"),
};

module.exports = config;
