{
  lib,
  stdenv,
  bun,
  nodejs_24,
  pkg-config,
  python3,
  gnumake,
  gcc,
  writableTmpDirAsHomeHook,
  rev ? "dirty",
  hash ? "sha256-b+lVeOmPN5yDuk/Z8N27TBqGQEQwphI28Ga2f5Z2ilg=",
}:
let
  source = import ./source.nix { inherit lib; };
  desktopPackageJson = builtins.fromJSON (builtins.readFile ../apps/desktop/package.json);
  platform = stdenv.hostPlatform;
  bunCpu =
    if platform.isAarch64 then "arm64"
    else if platform.isx86_64 then "x64"
    else throw "Unsupported CPU architecture for t3chat-node_modules: ${platform.system}";
  bunOs =
    if platform.isLinux then "linux"
    else if platform.isDarwin then "darwin"
    else throw "Unsupported OS for t3chat-node_modules: ${platform.system}";
in
stdenv.mkDerivation {
  pname = "t3chat-node_modules";
  version = "${desktopPackageJson.version}-${rev}";

  src = source.nodeModules;

  impureEnvVars = lib.fetchers.proxyImpureEnvVars ++ [
    "GIT_PROXY_COMMAND"
    "SOCKS_SERVER"
  ];

  nativeBuildInputs = [
    bun
    nodejs_24
    pkg-config
    python3
    gnumake
    gcc
    writableTmpDirAsHomeHook
  ];

  dontConfigure = true;

  buildPhase = ''
    runHook preBuild

    export BUN_INSTALL_CACHE_DIR="$(mktemp -d)"

    bun install \
      --backend=copyfile \
      --cpu="${bunCpu}" \
      --os="${bunOs}" \
      --frozen-lockfile \
      --ignore-scripts \
      --no-progress

    bun --bun ${./scripts/canonicalize-node-modules.ts}
    bun --bun ${./scripts/normalize-bun-binaries.ts}

    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall

    mkdir -p "$out"
    find . -type d -name node_modules -exec cp -R --parents {} "$out" \;

    runHook postInstall
  '';

  dontFixup = true;

  outputHashAlgo = "sha256";
  outputHashMode = "recursive";
  outputHash = hash;

  meta.platforms = [ "x86_64-linux" ];
}
