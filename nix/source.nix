{ lib }:
let
  root = ../.;
  clean = lib.fileset.fromSource (lib.sources.cleanSource root);
  workspaceFiles = lib.fileset.unions [
    ../apps/desktop
    ../apps/marketing
    ../apps/server
    ../apps/web
    ../packages/contracts
    ../packages/shared
    ../scripts
    ../package.json
    ../bun.lock
    ../tsconfig.base.json
    ../turbo.json
  ];
  buildFiles = lib.fileset.unions [
    workspaceFiles
    ../assets
  ];
in
{
  nodeModules = lib.fileset.toSource {
    inherit root;
    fileset = lib.fileset.intersection clean workspaceFiles;
  };

  build = lib.fileset.toSource {
    inherit root;
    fileset = lib.fileset.intersection clean buildFiles;
  };
}
