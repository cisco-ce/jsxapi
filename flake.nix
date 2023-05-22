{
  description = "JSXAPI flake";
  nixConfig.bash-prompt-suffix = "\[nix\] ";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
  };

  outputs = { self, nixpkgs }:
    let
      # System types to support.
      supportedSystems = [ "x86_64-linux" "x86_64-darwin" "aarch64-linux" "aarch64-darwin" ];

      # Helper function to generate an attrset '{ x86_64-linux = f "x86_64-linux"; ... }'.
      forAllSystems = nixpkgs.lib.genAttrs supportedSystems;

      # Nixpkgs instantiated for supported system types.
      nixpkgsFor = forAllSystems (system: import nixpkgs { inherit system; });
    in
    {
      # Utilized by `nix develop`
      devShell = forAllSystems (system:
        let
          pkgs = nixpkgsFor.${system};
          my-python = pkgs.python312;
          python-with-my-packages = my-python.withPackages (p: with p; [
            gyp
            setuptools
            # other python packages you want
          ]);
        in
        pkgs.mkShell {
          buildInputs = [
            pkgs.nodePackages.npm
            pkgs.nodejs
            python-with-my-packages
          ];
        }
      );
    };
}
