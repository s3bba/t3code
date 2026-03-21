{
  lib,
  stdenvNoCC,
  bun,
  nodejs_24,
  makeWrapper,
  electron_40,
  git,
  pkg-config,
  python3,
  gnumake,
  gcc,
  node_modules,
  commitHash ? null,
}:
let
  source = import ./source.nix { inherit lib; };
  desktopPackageJson = builtins.fromJSON (builtins.readFile ../apps/desktop/package.json);
  workspaceNodeModulesPaths = import ./workspace-node-modules-paths.nix;
  hasCommitHash = commitHash != null && builtins.match "^[0-9a-fA-F]+$" commitHash != null;
  runtimePackageJson = builtins.toJSON {
    name = "t3code";
    version = desktopPackageJson.version;
    private = true;
    productName = desktopPackageJson.productName or "T3 Code";
    main = "apps/desktop/dist-electron/main.js";
  };
in
stdenvNoCC.mkDerivation (finalAttrs: {
  pname = "t3code";
  version = desktopPackageJson.version;

  src = source.build;
  inherit node_modules;

  nativeBuildInputs = [
    bun
    nodejs_24
    makeWrapper
    pkg-config
    python3
    gnumake
    gcc
  ];

  ELECTRON_SKIP_BINARY_DOWNLOAD = "1";
  ELECTRON_OVERRIDE_DIST_PATH = "${electron_40}/bin";

  configurePhase = ''
    runHook preConfigure

    cp -R ${finalAttrs.node_modules}/. .
    for dir in \
      node_modules \
      ${lib.concatStringsSep " \\\n      " workspaceNodeModulesPaths}
    do
      if [ -e "$dir" ]; then
        chmod -R u+w "$dir"
        patchShebangs "$dir"
      fi
    done
    export HOME="$TMPDIR"
    export PATH="$PWD/node_modules/.bin:$PATH"

    runHook postConfigure
  '';

  buildPhase = ''
    runHook preBuild

    nodeGypShimDir="$(mktemp -d)"
    nodeGypJs="$(dirname "$(readlink -f "$(command -v npm)")")/../node_modules/node-gyp/bin/node-gyp.js"
    cat > "$nodeGypShimDir/node-gyp" <<EOF
#!${stdenvNoCC.shell}
exec ${nodejs_24}/bin/node "$nodeGypJs" "\$@"
EOF
    chmod +x "$nodeGypShimDir/node-gyp"
    export PATH="$nodeGypShimDir:$PATH"
    export PYTHON="${python3}/bin/python3"
    export npm_config_python="$PYTHON"
    export npm_config_node_gyp="$nodeGypJs"
    export npm_config_nodedir="${nodejs_24}"

    nodePtyDir="$(readlink -f apps/server/node_modules/node-pty)"
    (
      cd "$nodePtyDir"
      node scripts/prebuild.js || node-gyp rebuild
    )

    bun run --cwd apps/web build
    bun run --cwd apps/server build
    bun run --cwd apps/desktop build

    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall

    appDir="$out/share/t3code/app"
    mkdir -p "$appDir/apps/desktop" "$appDir/apps/server"

    printf '%s\n' '${runtimePackageJson}' > "$appDir/package.json"
    cp -R node_modules "$appDir/"
    cp -R apps/desktop/dist-electron "$appDir/apps/desktop/"
    cp -R apps/desktop/node_modules "$appDir/apps/desktop/"
    cp -R apps/desktop/resources "$appDir/apps/desktop/"
    cp -R apps/server/dist "$appDir/apps/server/"
    cp -R apps/server/node_modules "$appDir/apps/server/"
    rm -rf "$appDir/apps/desktop/node_modules/@t3tools"
    rm -rf "$appDir/apps/server/node_modules/@t3tools"

    wrapperArgs=(
      --add-flag "$appDir"
      --prefix PATH : ${lib.makeBinPath [ git ]}
      --add-flags "\''${NIXOS_OZONE_WL:+\''${WAYLAND_DISPLAY:+--ozone-platform-hint=auto --enable-features=WaylandWindowDecorations --enable-wayland-ime=true}}"
      --inherit-argv0
    )
    ${lib.optionalString hasCommitHash ''
      wrapperArgs+=(
        --set-default T3CODE_COMMIT_HASH ${commitHash}
      )
    ''}

    makeWrapper ${lib.getExe electron_40} "$out/bin/t3code" "''${wrapperArgs[@]}"

    runHook postInstall
  '';

  meta = {
    description = "T3 Code desktop launcher";
    homepage = "https://github.com/pingdotgg/t3code";
    license = lib.licenses.mit;
    mainProgram = "t3code";
    platforms = [ "x86_64-linux" ];
  };
})
